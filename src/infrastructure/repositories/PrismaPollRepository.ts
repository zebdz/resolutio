import {
  PrismaClient,
  PollState as PrismaPollState,
} from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import {
  PollRepository,
  PollSearchFilters,
} from '../../domain/poll/PollRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { QuestionType } from '../../domain/poll/QuestionType';
import { PollState } from '../../domain/poll/PollState';

export class PrismaPollRepository implements PollRepository {
  constructor(private prisma: PrismaClient) {}

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    try {
      const created = await this.prisma.poll.create({
        data: {
          title: poll.title,
          description: poll.description,
          organizationId: poll.organizationId,
          boardId: poll.boardId,
          createdBy: poll.createdBy,
          startDate: poll.startDate,
          endDate: poll.endDate,
          state: this.toPrismaState(poll.state),
          weightCriteria: poll.weightCriteria,
          distributionType: poll.distributionType,
          propertyAggregation: poll.propertyAggregation,
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
        },
      });

      return success(this.toDomainPoll(created));
    } catch (error) {
      console.error('Failed to create poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    try {
      const poll = await this.prisma.poll.findUnique({
        where: { id: pollId },
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
        },
      });

      if (!poll) {
        return success(null);
      }

      return success(this.toDomainPoll(poll));
    } catch (error) {
      console.error('Failed to get poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
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
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by board:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByOrganizationId(
    orgId: string
  ): Promise<Result<Poll[], string>> {
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
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by organization:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
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
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      console.error('Failed to get polls by user:', error);

      return failure('common.errors.unexpected');
    }
  }

  async searchPolls(
    filters: PollSearchFilters,
    userId?: string,
    adminOrgIds?: string[]
  ): Promise<Result<{ polls: Poll[]; totalCount: number }, string>> {
    try {
      const where: any = { archivedAt: null };

      if (filters.titleSearch) {
        where.title = {
          contains: filters.titleSearch,
          mode: 'insensitive',
        };
      }

      if (filters.statuses && filters.statuses.length > 0) {
        where.state = {
          in: filters.statuses.map((s) => this.toPrismaState(s)),
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

      const findManyArgs: any = {
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
        },
        orderBy: { createdAt: 'desc' },
      };

      if (filters.page && filters.pageSize) {
        findManyArgs.skip = (filters.page - 1) * filters.pageSize;
        findManyArgs.take = filters.pageSize;
      }

      const [polls, totalCount] = await Promise.all([
        this.prisma.poll.findMany(findManyArgs),
        this.prisma.poll.count({ where }),
      ]);

      return success({
        polls: polls.map((poll) => this.toDomainPoll(poll)),
        totalCount,
      });
    } catch (error) {
      console.error('Failed to search polls:', error);

      return failure('common.errors.unexpected');
    }
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    try {
      await this.prisma.poll.update({
        where: { id: poll.id },
        data: {
          title: poll.title,
          description: poll.description,
          startDate: poll.startDate,
          endDate: poll.endDate,
          state: this.toPrismaState(poll.state),
          weightCriteria: poll.weightCriteria,
          distributionType: poll.distributionType,
          propertyAggregation: poll.propertyAggregation,
          archivedAt: poll.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to update poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
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

  private toDomainPoll(prismaData: any): Poll {
    const questions = prismaData.questions
      ? prismaData.questions.map((q: any) => this.toDomainQuestion(q))
      : [];

    return Poll.reconstitute({
      id: prismaData.id,
      title: prismaData.title,
      description: prismaData.description,
      organizationId: prismaData.organizationId,
      boardId: prismaData.boardId,
      startDate: prismaData.startDate,
      endDate: prismaData.endDate,
      state: this.toDomainState(prismaData.state),
      weightCriteria: prismaData.weightCriteria || null,
      distributionType: prismaData.distributionType,
      propertyAggregation: prismaData.propertyAggregation,
      propertyIds: (prismaData.properties ?? []).map(
        (p: { propertyId: string }) => p.propertyId
      ),
      createdBy: prismaData.createdBy,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
      questions,
    });
  }

  private toDomainState(prismaState: PrismaPollState): PollState {
    switch (prismaState) {
      case 'DRAFT':
        return PollState.DRAFT;
      case 'READY':
        return PollState.READY;
      case 'ACTIVE':
        return PollState.ACTIVE;
      case 'FINISHED':
        return PollState.FINISHED;
    }
  }

  private toPrismaState(domainState: PollState): PrismaPollState {
    switch (domainState) {
      case PollState.DRAFT:
        return 'DRAFT';
      case PollState.READY:
        return 'READY';
      case PollState.ACTIVE:
        return 'ACTIVE';
      case PollState.FINISHED:
        return 'FINISHED';
    }
  }

  private toDomainQuestion(prismaData: any): Question {
    const answers = prismaData.answers
      ? prismaData.answers.map((a: any) => this.toDomainAnswer(a))
      : [];

    return Question.reconstitute({
      id: prismaData.id,
      text: prismaData.text,
      details: prismaData.details,
      pollId: prismaData.pollId,
      page: prismaData.page,
      order: prismaData.order,
      questionType: prismaData.questionType as QuestionType,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
      answers,
    });
  }

  private toDomainAnswer(prismaData: any): Answer {
    return Answer.reconstitute({
      id: prismaData.id,
      text: prismaData.text,
      order: prismaData.order,
      questionId: prismaData.questionId,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
    });
  }
}
