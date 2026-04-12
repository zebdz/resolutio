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

const useCase = new AnalyzePollLegalityUseCase({
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { model?: unknown };

  try {
    body = await _request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const model = typeof body.model === 'string' ? body.model : '';

  if (!AVAILABLE_MODELS.includes(model)) {
    return NextResponse.json(
      { error: await translateErrorCode(AIErrors.INVALID_MODEL) },
      { status: 400 }
    );
  }

  const { pollId } = await params;
  const locale = await getLocale();
  const isSuperadmin = await userRepository.isSuperAdmin(user.id);

  const validation = await useCase.validate({
    pollId,
    userId: user.id,
    model,
    locale,
    isSuperadmin,
  });

  if (!validation.success) {
    const status =
      validation.error === AIErrors.RATE_LIMIT_EXCEEDED ||
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
      model: aiProvider.getModel(model),
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({ schema: legalAnalysisResultSchema }),
    });

    const analysisResult = result.output;
    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;

    await legalCheckRepository.logCheckAttempt(
      pollId,
      user.id,
      inputTokens,
      outputTokens
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

    const created = LegalCheck.create({
      pollId,
      model,
      annotations: analysisResult.annotations,
      summary: analysisResult.summary,
      checkedBy: user.id,
    });

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
      .logCheckAttempt(pollId, user.id, 0, 0)
      .catch(() => undefined);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : await translateErrorCode(AIErrors.PROVIDER_ERROR),
      },
      { status: 502 }
    );
  }
}
