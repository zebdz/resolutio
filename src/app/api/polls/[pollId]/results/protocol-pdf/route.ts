/** Downloads the admin-only signing protocol with consent-filtered contacts and its record footer. */
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import {
  buildProtocolSignersPdfDefinition,
  type ProtocolSignersPdfData,
} from '@/web/lib/pdf/protocolSignersPdfGenerator';

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

  const { poll, protocolSignWillingness, canViewSignWillingness } =
    result.value;

  // Only admins can export protocol PDF. This document carries phone
  // numbers, so it stays admin-only even on a named poll where voter names
  // are open to the whole organization.
  if (!canViewSignWillingness) {
    return failure(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
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

  const pdfData: ProtocolSignersPdfData = {
    organizationName: org?.name ?? '',
    boardName,
    pollTitle: poll.title ?? '',
    entries: protocolSignWillingness.map((entry) => ({
      firstName: entry.firstName,
      lastName: entry.lastName,
      middleName: entry.middleName,
      willingToSignProtocol: entry.willingToSignProtocol,
      phoneNumber: entry.phoneNumber?.getValue() ?? null,
    })),
  };

  return success(pdfData);
}

export const GET = protocolDownload<ProtocolSignersPdfData>({
  filename: 'protocol-signers.pdf',
  readSource: (pollId, userId) =>
    getSealedProtocol.execute(pollId, userId, 'signersPdf'),
  readLive,
  build: (data, messages, footer) =>
    buildProtocolSignersPdfDefinition(
      data,
      messages.poll.results.protocolPdf,
      footer
    ),
});
