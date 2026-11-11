/** Stores the supplied eligibility identity/time and decodes stored snapshots.
 * Storage failures never expose database exception text to application callers. */
import { PollId } from '../../domain/shared/EntityIds';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollEligibleMember } from '../../domain/poll/PollEligibleMember';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';

export class PrismaPollEligibleMemberRepository implements PollEligibleMemberRepository {
  constructor(private prisma: PrismaClient) {}

  async createMany(
    members: PollEligibleMember[]
  ): Promise<Result<void, PollWriteFailure>> {
    try {
      if (members.length === 0) {
        return success(undefined);
      }

      await this.prisma.pollEligibleMember.createMany({
        data: members.map((m) => ({
          id: m.id,
          createdAt: m.createdAt,
          pollId: m.pollId,
          userId: m.userId,
          snapshotAt: m.snapshotAt,
        })),
        skipDuplicates: true,
      });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findByPollId(
    pollId: PollId
  ): Promise<Result<PollEligibleMember[], PollWriteFailure>> {
    try {
      const rows = await this.prisma.pollEligibleMember.findMany({
        where: { pollId },
      });

      return success(
        rows.map((r) =>
          PollEligibleMember.reconstitute({
            id: r.id,
            pollId: r.pollId,
            userId: r.userId,
            snapshotAt: r.snapshotAt,
            createdAt: r.createdAt,
          })
        )
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }
}
