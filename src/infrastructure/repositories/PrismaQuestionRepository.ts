import { PrismaClient } from '@/generated/prisma/client';
import { Question } from '../../domain/poll/Question';
import { Answer } from '../../domain/poll/Answer';
import {
  QuestionRepository,
  UpdateQuestionOrderData,
} from '../../domain/poll/QuestionRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { QuestionType } from '../../domain/poll/QuestionType';

export class PrismaQuestionRepository implements QuestionRepository {
  constructor(private prisma: PrismaClient) {}

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    try {
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
      console.error('Failed to create question:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to get question:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to get questions:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to update question:', error);

      return failure('common.errors.unexpected');
    }
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    try {
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
      console.error('Failed to update question order:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to delete question:', error);

      return failure('common.errors.unexpected');
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
