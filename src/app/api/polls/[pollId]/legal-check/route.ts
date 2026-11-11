/** Authenticated analysis adapter decodes request/provider values before core persistence.
 * Configuration failures become server errors before any provider request is made. */
import { AIModelKey, TokenCount } from '@/domain/ai/LegalAnalysis';
import { LegalCheckId } from '@/domain/shared/EntityIds';
import {
  CryptoIdGenerator,
  SystemClock,
} from '@/infrastructure/shared/SystemEntityCreation';
import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { getLocale } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { PrismaLegalCheckRepository } from '@/infrastructure/repositories/PrismaLegalCheckRepository';
import { PrismaSystemSettingRepository } from '@/infrastructure/repositories/PrismaSystemSettingRepository';
import {
  AIProviderAdapter,
  AVAILABLE_MODELS,
} from '@/infrastructure/ai/AIProviderAdapter';
import { AnalyzePollLegalityUseCase } from '@/application/ai/AnalyzePollLegalityUseCase';
import { legalAnalysisResultSchema } from '@/application/ai/legalAnalysisSchema';
import { LegalCheck } from '@/domain/ai/LegalCheck';
import { AIErrors } from '@/application/ai/AIErrors';
import {
  buildSystemPrompt,
  buildUserPrompt,
} from '@/infrastructure/ai/prompts/legalAnalysisPrompt';
import { AILogger } from '@/infrastructure/ai/AILogger';

export const maxDuration = 60;

const pollRepository = new PrismaPollRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const legalCheckRepository = new PrismaLegalCheckRepository(prisma);
const systemSettingRepository = new PrismaSystemSettingRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const aiProvider = new AIProviderAdapter();
const aiLogger = new AILogger();

const ids = new CryptoIdGenerator();
const clock = new SystemClock();
const useCase = new AnalyzePollLegalityUseCase({
  clock,
  pollRepository,
  organizationRepository,
  legalCheckRepository,
  systemSettingRepository,
});

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json({ error: rateLimited.error }, { status: 429 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: await translateErrorCode('common.errors.unauthorized') },
      { status: 401 }
    );
  }

  let body: { model?: unknown };

  try {
    body = await _request.json();
  } catch {
    return NextResponse.json(
      { error: await translateErrorCode('common.errors.validationFailed') },
      { status: 400 }
    );
  }

  const model = typeof body.model === 'string' ? body.model : '';

  if (!AVAILABLE_MODELS.some((key) => key === model)) {
    return NextResponse.json(
      { error: await translateErrorCode(AIErrors.INVALID_MODEL) },
      { status: 400 }
    );
  }

  const { pollId: requestedPollId } = await params;
  const locale = await getLocale();
  const isSuperadmin = await userRepository.isSuperAdmin(user.id);

  const validation = await useCase.validate({
    pollId: requestedPollId,
    userId: user.id,
    model,
    locale,
    isSuperadmin,
  });

  if (!validation.success) {
    const status =
      validation.error === 'common.errors.unexpected'
        ? 500
        : validation.error === AIErrors.RATE_LIMIT_EXCEEDED ||
            validation.error === AIErrors.TOKEN_CAP_EXCEEDED
          ? 429
          : validation.error === AIErrors.NOT_ADMIN
            ? 403
            : validation.error === AIErrors.POLL_NOT_FOUND
              ? 404
              : 400;

    return NextResponse.json(
      { error: await translateErrorCode(validation.error) },
      { status }
    );
  }

  const { poll } = validation.value;
  const pollId = poll.id;

  const pollData = {
    title: poll.title,
    description: poll.description,
    questions: poll.questions.map((q) => ({
      id: q.id,
      text: q.text,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text })),
    })),
  };

  const systemPrompt = buildSystemPrompt(locale);
  const userPrompt = buildUserPrompt(pollData);

  try {
    const result = await generateText({
      model: aiProvider.getModel(validation.value.model),
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({ schema: legalAnalysisResultSchema }),
    });

    const analysisResult = result.output;
    const inputTokens = TokenCount.parse(result.usage.inputTokens ?? 0);
    const outputTokens = TokenCount.parse(result.usage.outputTokens ?? 0);

    await legalCheckRepository.logCheckAttempt(
      pollId,
      user.id,
      { input: inputTokens, output: outputTokens },
      clock.now()
    );

    if (!analysisResult) {
      await aiLogger.logError({
        pollId,
        userId: user.id,
        model,
        error: 'Schema validation failed on LLM output',
      });

      return NextResponse.json(
        { error: await translateErrorCode(AIErrors.PROVIDER_ERROR) },
        { status: 502 }
      );
    }

    const existing = await legalCheckRepository.findByPollId(pollId);
    const created = LegalCheck.create(
      {
        pollId,
        model: validation.value.model,
        annotations: analysisResult.annotations,
        summary: analysisResult.summary,
        checkedBy: user.id,
      },
      { id: existing?.check.id ?? ids.generate(LegalCheckId), now: clock.now() }
    );

    if (created.success) {
      await legalCheckRepository.upsert(created.value);
    }

    await aiLogger.logSuccess({
      pollId,
      userId: user.id,
      model,
      inputTokens,
      outputTokens,
      annotationCount: analysisResult.annotations.length,
      overallRisk: analysisResult.summary.overallRisk,
      message: 'Analysis complete',
    });

    return NextResponse.json({
      success: true,
      data: {
        annotations: analysisResult.annotations,
        summary: analysisResult.summary,
      },
    });
  } catch (error) {
    await aiLogger.logError({
      pollId,
      userId: user.id,
      model,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    await legalCheckRepository
      .logCheckAttempt(
        pollId,
        user.id,
        { input: TokenCount.parse(0), output: TokenCount.parse(0) },
        clock.now()
      )
      .catch(() => undefined);

    return NextResponse.json(
      { error: await translateErrorCode(AIErrors.PROVIDER_ERROR) },
      { status: 502 }
    );
  }
}
