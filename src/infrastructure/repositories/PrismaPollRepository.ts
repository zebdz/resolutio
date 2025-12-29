import { PrismaClient } from '@/generated/prisma/client';
import { Poll } from '../../domain/poll/Poll';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import {
  PollRepository,
  CreatePollData,
  CreateQuestionData,
  CreateAnswerData,
  UpdateQuestionOrderData,
} from '../../domain/poll/PollRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { QuestionType } from '../../domain/poll/QuestionType';

export class PrismaPollRepository implements PollRepository {
  constructor(private prisma: PrismaClient) {}

  // Poll operations
  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.poll.create({
        data: {
          title: poll.title,
          description: poll.description,
          boardId: poll.boardId,
          createdBy: poll.createdBy,
          startDate: poll.startDate,
          endDate: poll.endDate,
          active: false,
          finished: false,
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
      // Get polls from boards where the user is a member
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
          active: poll.active,
          finished: poll.finished,
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

  // Question operations
  async createQuestion(question: Question): Promise<Result<Question, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.question.create({
        data: {
          text: question.text,
          details: question.details,
          pollId: question.pollId,
          page: question.page,
          order: question.order,
          questionType: question.questionType,
        },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      return success(this.toDomainQuestion(created));
    } catch (error) {
      return failure(`Failed to create question: ${error}`);
    }
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    try {
      const question = await this.prisma.question.findUnique({
        where: { id: questionId },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!question) {
        return success(null);
      }

      return success(this.toDomainQuestion(question));
    } catch (error) {
      return failure(`Failed to get question: ${error}`);
    }
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    try {
      const questions = await this.prisma.question.findMany({
        where: {
          pollId,
          archivedAt: null,
        },
        include: {
          answers: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: [{ page: 'asc' }, { order: 'asc' }],
      });

      return success(questions.map((q) => this.toDomainQuestion(q)));
    } catch (error) {
      return failure(`Failed to get questions: ${error}`);
    }
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    try {
      await this.prisma.question.update({
        where: { id: question.id },
        data: {
          text: question.text,
          details: question.details,
          page: question.page,
          order: question.order,
          questionType: question.questionType,
          archivedAt: question.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update question: ${error}`);
    }
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    try {
      // Use a transaction to update all questions atomically
      await this.prisma.$transaction(
        updates.map((update) =>
          this.prisma.question.update({
            where: { id: update.questionId },
            data: {
              page: update.page,
              order: update.order,
            },
          })
        )
      );

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update question order: ${error}`);
    }
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.question.update({
        where: { id: questionId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete question: ${error}`);
    }
  }

  // Answer operations
  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    try {
      // Persist the already-validated domain model
      const created = await this.prisma.answer.create({
        data: {
          text: answer.text,
          order: answer.order,
          questionId: answer.questionId,
        },
      });

      return success(this.toDomainAnswer(created));
    } catch (error) {
      return failure(`Failed to create answer: ${error}`);
    }
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    try {
      const answer = await this.prisma.answer.findUnique({
        where: { id: answerId },
      });

      if (!answer) {
        return success(null);
      }

      return success(this.toDomainAnswer(answer));
    } catch (error) {
      return failure(`Failed to get answer: ${error}`);
    }
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    try {
      const answers = await this.prisma.answer.findMany({
        where: {
          questionId,
          archivedAt: null,
        },
        orderBy: { order: 'asc' },
      });

      return success(answers.map((a) => this.toDomainAnswer(a)));
    } catch (error) {
      return failure(`Failed to get answers: ${error}`);
    }
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    try {
      await this.prisma.answer.update({
        where: { id: answer.id },
        data: {
          text: answer.text,
          order: answer.order,
          archivedAt: answer.archivedAt,
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to update answer: ${error}`);
    }
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.answer.update({
        where: { id: answerId },
        data: { archivedAt: new Date() },
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to delete answer: ${error}`);
    }
  }

  // Helper methods to convert Prisma models to domain entities
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
      active: prismaData.active,
      finished: prismaData.finished,
      createdBy: prismaData.createdBy,
      createdAt: prismaData.createdAt,
      archivedAt: prismaData.archivedAt,
      questions,
    });
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
