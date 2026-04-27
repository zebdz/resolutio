import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollEligibleMember } from '../../domain/poll/PollEligibleMember';
import { PollEligibleMemberRepository } from '../../domain/poll/PollEligibleMemberRepository';

export class PrismaPollEligibleMemberRepository implements PollEligibleMemberRepository {
  constructor(private prisma: PrismaClient) {}

  async createMany(
    members: PollEligibleMember[]
  ): Promise<Result<void, string>> {
    try {
      if (members.length === 0) {
        return success(undefined);
      }

      await this.prisma.pollEligibleMember.createMany({
        data: members.map((m) => ({
          pollId: m.pollId,
          userId: m.userId,
          snapshotAt: m.snapshotAt,
        })),
        skipDuplicates: true,
      });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByPollId(
    pollId: string
  ): Promise<Result<PollEligibleMember[], string>> {
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
      return failure((e as Error).message);
    }
  }
}
