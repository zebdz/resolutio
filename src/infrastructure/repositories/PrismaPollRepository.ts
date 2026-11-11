/** Poll persistence with parent-row locking and optimistic revision checks.
 * A stale lifecycle or full-row save cannot overwrite a committed finish. */
import { ResultCount } from '../../domain/shared/Pagination';
import {
  PollId,
  BoardId,
  OrganizationId,
  UserId,
} from '../../domain/shared/EntityIds';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { lockPollRevision, pollWriteError } from './PollWriteLock';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import {
  editablePollInclude,
  pollUpdateData,
  toDomainPoll,
  toPrismaState,
  toPrismaPollType,
} from './PrismaPollMapper';
import {
  PollRepository,
  PollSearchFilters,
} from '../../domain/poll/PollRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaPollRepository implements PollRepository {
  constructor(private prisma: PrismaClient) {}

  async createPoll(poll: Poll): Promise<Result<Poll, PollWriteFailure>> {
    try {
      const created = await this.prisma.poll.create({
        data: {
          id: poll.id,
          createdAt: poll.createdAt,
          title: poll.title,
          description: poll.description,
          organizationId: poll.organizationId,
          boardId: poll.boardId,
          pollType: toPrismaPollType(poll.pollType),
          createdBy: poll.createdBy,
          startDate: poll.startDate,
          endDate: poll.endDate,
          state: toPrismaState(poll.state),
          weightCriteria: poll.weightCriteria,
          distributionType: poll.distributionType,
          propertyAggregation: poll.propertyAggregation,
          anonymous: poll.isAnonymous(),
          properties:
            poll.propertyIds.length > 0
              ? {
                  createMany: {
                    data: poll.propertyIds.map((propertyId) => ({
                      propertyId,
                    })),
                  },
                }
              : undefined,
        },
        include: {
          questions: {
            include: {
              answers: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
          properties: true,
          // Ids only — never `bytes`. The description renderer needs the id
          // allowlist so it can refuse refs to other polls' files; file
          // content is served solely by the download route.
          attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
      });

      return success(toDomainPoll(created));
    } catch (error) {
      console.error('Failed to create poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollById(
    pollId: PollId
  ): Promise<Result<Poll | null, PollWriteFailure>> {
    try {
      const poll = await this.prisma.poll.findUnique({
        where: { id: pollId },
        include: editablePollInclude,
      });

      if (!poll) {
        return success(null);
      }

      return success(toDomainPoll(poll));
    } catch (error) {
      console.error('Failed to get poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByBoardId(
    boardId: BoardId
  ): Promise<Result<Poll[], PollWriteFailure>> {
    try {
      const polls = await this.prisma.poll.findMany({
        where: {
          boardId,
          archivedAt: null,
        },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
          properties: true,
          // Ids only — never `bytes`. The description renderer needs the id
          // allowlist so it can refuse refs to other polls' files; file
          // content is served solely by the download route.
          attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by board:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByOrganizationId(
    orgId: OrganizationId
  ): Promise<Result<Poll[], PollWriteFailure>> {
    try {
      const polls = await this.prisma.poll.findMany({
        where: {
          organizationId: orgId,
          archivedAt: null,
        },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
          properties: true,
          // Ids only — never `bytes`. The description renderer needs the id
          // allowlist so it can refuse refs to other polls' files; file
          // content is served solely by the download route.
          attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by organization:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByUserId(
    userId: UserId
  ): Promise<Result<Poll[], PollWriteFailure>> {
    try {
      const polls = await this.prisma.poll.findMany({
        where: {
          OR: [
            {
              organization: {
                members: {
                  some: {
                    userId,
                    status: 'accepted',
                  },
                },
              },
            },
            {
              board: {
                members: {
                  some: {
                    userId,
                    removedAt: null,
                  },
                },
              },
            },
            {
              participants: {
                some: {
                  userId,
                },
              },
            },
          ],
          archivedAt: null,
        },
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
          properties: true,
          // Ids only — never `bytes`. The description renderer needs the id
          // allowlist so it can refuse refs to other polls' files; file
          // content is served solely by the download route.
          attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by user:', error);

      return failure('common.errors.unexpected');
    }
  }

  async searchPolls(
    filters: PollSearchFilters,
    userId?: UserId,
    adminOrgIds?: OrganizationId[]
  ): Promise<
    Result<{ polls: Poll[]; totalCount: ResultCount }, PollWriteFailure>
  > {
    try {
      const where: Prisma.PollWhereInput = { archivedAt: null };

      if (filters.titleSearch) {
        where.title = {
          contains: filters.titleSearch,
          mode: 'insensitive',
        };
      }

      if (filters.statuses && filters.statuses.length > 0) {
        where.state = {
          in: filters.statuses.map((s) => toPrismaState(s)),
        };
      }

      if (filters.organizationId) {
        where.organizationId = filters.organizationId;
      }

      if (filters.boardId) {
        where.boardId = filters.boardId;
      } else if (filters.orgWideOnly) {
        where.boardId = null;
      }

      if (filters.createdFrom || filters.createdTo) {
        where.createdAt = {};

        if (filters.createdFrom) {
          where.createdAt.gte = filters.createdFrom;
        }

        if (filters.createdTo) {
          where.createdAt.lte = filters.createdTo;
        }
      }

      if (filters.startFrom || filters.startTo) {
        where.startDate = {};

        if (filters.startFrom) {
          where.startDate.gte = filters.startFrom;
        }

        if (filters.startTo) {
          where.startDate.lte = filters.startTo;
        }
      }

      if (userId) {
        where.OR = [
          {
            organization: {
              members: {
                some: { userId, status: 'accepted' },
              },
            },
          },
          {
            board: {
              members: {
                some: { userId, removedAt: null },
              },
            },
          },
          {
            participants: {
              some: { userId },
            },
          },
          // Creator branch: a user who creates a poll on an org they're not
          // a member/admin of (e.g., a child-org admin scoping into the
          // parent) must still see and be able to edit/manage their own poll
          // before someone activates it.
          { createdBy: userId },
        ];

        if (adminOrgIds && adminOrgIds.length > 0) {
          where.OR.push({
            organizationId: { in: adminOrgIds },
          });
        }
      }

      const findManyArgs = {
        where,
        include: {
          questions: {
            where: { archivedAt: null },
            include: {
              answers: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' },
              },
            },
            orderBy: [{ page: 'asc' }, { order: 'asc' }],
          },
          properties: true,
          // Ids only — never `bytes`. The description renderer needs the id
          // allowlist so it can refuse refs to other polls' files; file
          // content is served solely by the download route.
          attachments: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        ...(filters.page && filters.pageSize
          ? {
              skip: (filters.page - 1) * filters.pageSize,
              take: filters.pageSize,
            }
          : {}),
      } satisfies Prisma.PollFindManyArgs;

      const [polls, totalCount] = await Promise.all([
        this.prisma.poll.findMany(findManyArgs),
        this.prisma.poll.count({ where }),
      ]);

      return success({
        polls: polls.map((poll) => toDomainPoll(poll)),
        totalCount: ResultCount.parse(totalCount),
      });
    } catch (error) {
      console.error('Failed to search polls:', error);

      return failure('common.errors.unexpected');
    }
  }

  async updatePoll(poll: Poll): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockPollRevision(tx, poll);

        await tx.poll.update({
          where: { id: poll.id },
          data: pollUpdateData(poll),
        });
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to update poll:', error);

      return failure(pollWriteError(error));
    }
  }

  async deletePoll(pollId: PollId): Promise<Result<void, PollWriteFailure>> {
    try {
      await this.prisma.poll.update({
        where: { id: pollId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete poll:', error);

      return failure('common.errors.unexpected');
    }
  }
}
