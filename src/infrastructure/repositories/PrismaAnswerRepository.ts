import { PrismaClient } from '@/generated/prisma/client';
import { Answer } from '../../domain/poll/Answer';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaAnswerRepository implements AnswerRepository {
  constructor(private prisma: PrismaClient) {}

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    try {
      const created = await this.prisma.answer.create({
        data: {
          text: answer.text,
          order: answer.order,
          questionId: answer.questionId,
        },
      });

      return success(this.toDomainAnswer(created));
    } catch (error) {
      console.error('Failed to create answer:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to get answer:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to get answers:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to update answer:', error);

      return failure('common.errors.unexpected');
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
      console.error('Failed to delete answer:', error);

      return failure('common.errors.unexpected');
    }
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
