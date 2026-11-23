/** Implements the application's snapshot transaction port using the shared poll
 * lock. Business decisions stay in the callback; this adapter only reads/writes. */
import {
  PollSnapshotTransaction,
  LockedPollSnapshot,
} from '@/application/poll/PollSnapshotTransaction';
import { PollId } from '@/domain/poll/PollValues';
import { PollDomainCode } from '@/domain/poll/PollDomainCodes';
import { PollWriteFailure } from '@/domain/poll/PollWriteFailure';
import { Result, failure } from '@/domain/shared/Result';
import { PrismaClient } from '@/generated/prisma/client';
import { lockPoll, pollWriteError, PollWriteError } from './PollWriteLock';
import {
  editablePollInclude,
  toDomainPoll,
  pollUpdateData,
} from './PrismaPollMapper';

export class PrismaPollSnapshotTransaction implements PollSnapshotTransaction {
  constructor(private readonly prisma: PrismaClient) {}

  async withLockedPoll(
    pollId: PollId,
    work: (
      snapshot: LockedPollSnapshot
    ) => Promise<Result<void, PollDomainCode>>
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockPoll(tx, pollId);
        const row = await tx.poll.findUniqueOrThrow({
          where: { id: pollId },
          include: editablePollInclude,
        });
        const poll = toDomainPoll(row);

        const result = await work({
          poll,
          hasVotes: async () =>
            (await tx.vote.count({ where: { question: { pollId } } })) > 0,
          savePoll: async () => {
            await tx.poll.update({
              where: { id: pollId },
              data: pollUpdateData(poll),
            });
          },
          removeParticipantSnapshot: async () => {
            await tx.pollParticipant.deleteMany({ where: { pollId } });
          },
        });

        if (!result.success) {
          // Prisma commits resolved callbacks, even if they return a failed Result.
          throw new PollWriteError(result.error);
        }

        return result;
      });
    } catch (error) {
      return failure(pollWriteError(error));
    }
  }
}
