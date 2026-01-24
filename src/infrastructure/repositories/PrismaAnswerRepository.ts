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
