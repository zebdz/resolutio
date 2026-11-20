/** Downloads the authorized named voting register, holdings and answer lists with their source. */
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';
import { GetNamedProtocolUseCase } from '@/application/poll/GetNamedProtocolUseCase';
import { User } from '@/domain/user/User';
import { isOwnershipMode } from '@/domain/poll/DistributionType';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
  PrismaPropertyAssetRepository,
} from '@/infrastructure/index';
import {
  buildNamedProtocolPdfDefinition,
  NamedProtocolPdfInput,
} from '@/web/lib/pdf/namedProtocolPdfGenerator';

import { success } from '@/domain/shared/Result';
import type { PollId, UserId } from '@/domain/shared/EntityIds';
import { protocolDownload } from '@/web/lib/pdf/protocolDownload';
import { getSealedProtocol } from '@/infrastructure/seal/getSealedProtocol';

const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const propertyAssetRepository = new PrismaPropertyAssetRepository(prisma);

const getNamedProtocolUseCase = new GetNamedProtocolUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository,
  propertyAssetRepository
);

async function readLive(pollId: PollId, userId: UserId) {
  const result = await getNamedProtocolUseCase.execute({
    pollId,
    userId,
  });

  if (!result.success) {
    return result;
  }

  const {
    poll,
    register,
    questions,
    totalParticipants,
    totalParticipantWeight,
  } = result.value;

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

  const pdfData: NamedProtocolPdfInput = {
    organizationName: org?.name ?? '',
    boardName,
    pollTitle: poll.title ?? '',
    pollDescription: stripMarkdownToPlainText(poll.description ?? ''),
    startDate: poll.startDate ? poll.startDate.toISOString().split('T')[0] : '',
    endDate: poll.endDate ? poll.endDate.toISOString().split('T')[0] : '',
    // A poll that is still running produces an interim document.
    isPreliminary: poll.isActive(),
    isPropertyBased: isOwnershipMode(poll.distributionType),
    isOpenPoll: poll.isOpen(),
    totalParticipants,
    totalParticipantWeight,
    register: register.map((person) => ({
      userId: person.userId,
      fullName: User.formatFullName(
        person.firstName,
        person.lastName,
        person.middleName
      ),
      weight: person.weight,
      holdings: person.holdings.map((h) => ({
        propertyName: h.propertyName,
        assetName: h.assetName,
        size: h.size,
        sizeUnitKey: h.sizeUnitKey,
        share: h.share,
      })),
    })),
    questions: questions.map((q) => ({
      questionText: q.questionText ?? '',
      questionDetails: q.questionDetails,
      questionType: q.questionType,
      totalVotes: q.totalVotes,
      totalWeight: q.totalWeight,
      answers: q.answers.map((a) => ({
        answerText: a.answerText ?? '',
        voteCount: a.voteCount,
        totalWeight: a.totalWeight,
        percentage: a.percentage,
        voters: a.voters.map((v) => ({
          userId: v.userId,
          weight: v.weight,
        })),
      })),
      nonVoterIds: q.nonVoterIds,
    })),
  };

  return success(pdfData);
}

export const GET = protocolDownload<NamedProtocolPdfInput>({
  filename: 'named-protocol.pdf',
  readSource: (pollId, userId) =>
    getSealedProtocol.execute(pollId, userId, 'namedPdf'),
  readLive,
  build: (data, messages, footer) =>
    buildNamedProtocolPdfDefinition(
      data,
      {
        ...messages.poll.results.namedPdf,
        sizeUnits: Object.fromEntries(
          Object.entries(messages.propertyAdmin.sizeUnit).map(
            ([key, label]) => ['propertyAdmin.sizeUnit.' + key, label]
          )
        ),
      },
      footer
    ),
});
