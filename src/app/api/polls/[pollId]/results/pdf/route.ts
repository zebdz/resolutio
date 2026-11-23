/** Downloads a policy-authorized results protocol from the sealed tallies or a labeled live view. */
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import { PollResultsPolicy } from '@/domain/poll/PollResultsPolicy';
import type { QuestionType } from '@/src/domain/poll/QuestionType';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import {
  buildPdfDocumentDefinition,
  PdfInputData,
} from '@/web/lib/pdf/pollResultsPdfGenerator';

import { success, failure } from '@/domain/shared/Result';
import type { PollId, UserId } from '@/domain/shared/EntityIds';
import { protocolDownload } from '@/web/lib/pdf/protocolDownload';
import { getSealedProtocol } from '@/infrastructure/seal/getSealedProtocol';

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

async function readLive(pollId: PollId, userId: UserId) {
  const result = await getPollResultsUseCase.execute({
    pollId,
    userId,
  });

  if (!result.success) {
    return result;
  }

  const {
    poll,
    results,
    totalParticipants,
    totalParticipantWeight,
    viewerFacts,
  } = result.value;

  // A named poll may be exported mid-vote; an anonymous one stays sealed
  // until it finishes.
  const exportable = PollResultsPolicy.canExportProtocol(poll, viewerFacts);

  if (!exportable.success) {
    return failure(exportable.error);
  }

  // Resolve current organization and board for live exports.
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

  // A voter contributes their weight once even when choosing several answers.
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

  const pdfData: PdfInputData = {
    organizationName: org?.name ?? '',
    boardName,
    pollTitle: poll.title ?? '',
    pollDescription: stripMarkdownToPlainText(poll.description ?? ''),
    startDate: poll.startDate ? poll.startDate.toISOString().split('T')[0] : '',
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

  return success(pdfData);
}

export const GET = protocolDownload<PdfInputData>({
  filename: 'results.pdf',
  readSource: (pollId, userId) =>
    getSealedProtocol.execute(pollId, userId, 'resultsPdf'),
  readLive,
  build: (data, messages, footer) =>
    buildPdfDocumentDefinition(data, messages.poll.results.pdf, footer),
});
