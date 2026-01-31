import {
  PrismaClient,
  PollState as PrismaPollState,
} from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import { PollRepository } from '../../domain/poll/PollRepository';
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
          boardId: poll.boardId,
          createdBy: poll.createdBy,
          startDate: poll.startDate,
          endDate: poll.endDate,
          state: this.toPrismaState(poll.state),
          weightCriteria: poll.weightCriteria,
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
        },
      });

      return success(this.toDomainPoll(created));
    } catch (error) {
      return failure(`Failed to create poll: ${error}`);
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
        },
      });

      if (!poll) {
        return success(null);
      }

      return success(this.toDomainPoll(poll));
    } catch (error) {
      return failure(`Failed to get poll: ${error}`);
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
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      return failure(`Failed to get polls by board: ${error}`);
    }
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    try {
      const polls = await this.prisma.poll.findMany({
        where: {
          board: {
            members: {
              some: {
                userId,
                removedAt: null,
              },
            },
          },
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
        },
        orderBy: { createdAt: 'desc' },
      });

      return success(polls.map((poll) => this.toDomainPoll(poll)));
    } catch (error) {
      return failure(`Failed to get polls by user: ${error}`);
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
          archivedAt: poll.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update poll: ${error}`);
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
      return failure(`Failed to delete poll: ${error}`);
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
      boardId: prismaData.boardId,
      startDate: prismaData.startDate,
      endDate: prismaData.endDate,
      state: this.toDomainState(prismaData.state),
      weightCriteria: prismaData.weightCriteria || null,
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
