/** Choose one authorized source for the results page and direct action callers.
 * Live rows are consulted only when the poll has no saved seal. */
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import { success } from '@/domain/shared/Result';
import type { PollId, UserId } from '@/domain/shared/EntityIds';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaParticipantRepository,
  PrismaPollRepository,
  PrismaUserRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import { getSealedProtocol } from '@/infrastructure/seal/getSealedProtocol';
import { serializePollResults } from '@/web/actions/poll/PollResultsView';

const liveResults = new GetPollResultsUseCase(
  new PrismaPollRepository(prisma),
  new PrismaParticipantRepository(prisma),
  new PrismaVoteRepository(prisma),
  new PrismaOrganizationRepository(prisma),
  new PrismaUserRepository(prisma)
);

export async function readPollResults(pollId: PollId, userId: UserId) {
  const source = await getSealedProtocol.execute(pollId, userId, 'page');

  if (!source.success) {
    return source;
  }

  if (source.value.kind === 'sealed') {
    return success(source.value);
  }

  const current = await liveResults.execute({ pollId, userId });

  if (!current.success) {
    return current;
  }

  // A seal or a change of permissions may land while live votes and names are read.
  const latest = await getSealedProtocol.execute(pollId, userId, 'page');

  if (!latest.success) {
    return latest;
  }

  if (latest.value.kind === 'sealed') {
    return success(latest.value);
  }

  return success({
    kind: 'live' as const,
    coverage: latest.value.coverage,
    poll: current.value.poll,
    data: serializePollResults({
      ...current.value,
      canViewVoterNames:
        current.value.canViewVoterNames && latest.value.canViewVoterNames,
      canViewSignWillingness:
        current.value.canViewSignWillingness &&
        latest.value.canViewSignWillingness,
    }),
  });
}
