import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import type { QuestionType } from '@/src/domain/poll/QuestionType';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import { isValidLocale, defaultLocale } from '@/src/i18n/locales';
import {
  buildPdfDocumentDefinition,
  generatePdfBuffer,
  PdfInputData,
  PdfTranslations,
} from '@/web/lib/pdf/pollResultsPdfGenerator';

const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

const getPollResultsUseCase = new GetPollResultsUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository
);

function loadTranslations(
  messages: Record<string, any>,
  prefix: string
): PdfTranslations {
  const keys = prefix.split('.');
  let obj: any = messages;

  for (const k of keys) {
    obj = obj?.[k];
  }

  return obj as PdfTranslations;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pollId: string }> }
) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pollId } = await params;

    // 2. Fetch poll results via use case
    const result = await getPollResultsUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    const { poll, results, totalParticipants, totalParticipantWeight } =
      result.value;

    // 3. Only allow PDF export for finished polls
    if (!poll.isFinished()) {
      return NextResponse.json(
        { error: 'poll.errors.notFinished' },
        { status: 400 }
      );
    }

    // 4. Fetch org name + board name
    const org = await prisma.organization.findUnique({
      where: { id: poll.organizationId },
      select: { name: true },
    });

    let boardName: string | null = null;

    if (poll.boardId) {
      const board = await prisma.board.findUnique({
        where: { id: poll.boardId },
        select: { name: true },
      });
      boardName = board?.name ?? null;
    }

    // 5. Load translations for requested locale
    const localeParam = request.nextUrl.searchParams.get('locale');
    const locale =
      localeParam && isValidLocale(localeParam) ? localeParam : defaultLocale;
    const messagesPath = path.join(process.cwd(), 'messages', `${locale}.json`);
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'));
    const t = loadTranslations(messages, 'poll.results.pdf');

    // 6. Calculate votedParticipants + weightOfVoted
    const voterIds = new Set<string>();
    let weightOfVoted = 0;

    for (const q of results) {
      for (const a of q.answers) {
        for (const v of a.voters) {
          if (!voterIds.has(v.userId)) {
            voterIds.add(v.userId);
            weightOfVoted +=
              typeof v.weight === 'object' ? Number(v.weight) : v.weight;
          }
        }
      }
    }

    // 7. Build PDF input data
    const pdfData: PdfInputData = {
      organizationName: org?.name ?? '',
      boardName,
      pollTitle: poll.title ?? '',
      pollDescription: poll.description ?? '',
      startDate: poll.startDate
        ? poll.startDate.toISOString().split('T')[0]
        : '',
      endDate: poll.endDate ? poll.endDate.toISOString().split('T')[0] : '',
      totalParticipants,
      votedParticipants: voterIds.size,
      totalWeight: Number(totalParticipantWeight) || 0,
      weightOfVoted: Number(weightOfVoted) || 0,
      questions: results.map((q) => ({
        questionText: q.questionText ?? '',
        questionDetails: q.questionDetails,
        questionType: (q.questionType ?? 'single-choice') as QuestionType,
        totalVotes: q.totalVotes ?? 0,
        totalWeight: q.answers.reduce(
          (sum, a) => sum + (Number(a.totalWeight) || 0),
          0
        ),
        answers: q.answers.map((a) => ({
          answerText: a.answerText ?? '',
          voteCount: a.voteCount ?? 0,
          weightedVotes: Number(a.totalWeight) || 0,
          percentage: Number(a.percentage) || 0,
        })),
      })),
    };

    // 8. Generate PDF
    const docDefinition = buildPdfDocumentDefinition(pdfData, t);
    const pdfBuffer = await generatePdfBuffer(docDefinition);

    // 9. Return PDF response
    // Keep letters (incl Cyrillic), digits, spaces, hyphens
    const sanitizedTitle =
      (poll.title ?? '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'poll';
    const filename = `${sanitizedTitle}-results.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="results.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error(
      'PDF generation error:',
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error
    );

    return NextResponse.json(
      { error: 'common.errors.unexpected' },
      { status: 500 }
    );
  }
}
