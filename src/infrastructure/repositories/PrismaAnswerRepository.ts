/** Maps answer aggregates to Prisma without replacing identity or time.
 * Persisted scalar fields are validated by aggregate reconstitution. */
import { AnswerId, QuestionId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { AnswerRepositoryFailure } from '@/domain/poll/AnswerRepository';
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Answer } from '../../domain/poll/Answer';
import { AnswerRepository } from '../../domain/poll/AnswerRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaAnswerRepository implements AnswerRepository {
  constructor(private prisma: PrismaClient) {}

  async createAnswer(
    answer: Answer
  ): Promise<Result<Answer, AnswerRepositoryFailure>> {
    try {
      const created = await this.prisma.answer.create({
        data: {
          id: answer.id,
          createdAt: answer.createdAt,
          archivedAt: answer.archivedAt,
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
    answerId: AnswerId
  ): Promise<Result<Answer | null, AnswerRepositoryFailure>> {
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
    questionId: QuestionId
  ): Promise<Result<Answer[], AnswerRepositoryFailure>> {
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

  async updateAnswer(
    answer: Answer
  ): Promise<Result<void, AnswerRepositoryFailure>> {
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

  async deleteAnswer(
    answerId: AnswerId,
    at: Instant
  ): Promise<Result<void, AnswerRepositoryFailure>> {
    try {
      await this.prisma.answer.update({
        where: { id: answerId },
        data: { archivedAt: Instant.toDate(at) },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete answer:', error);

      return failure('common.errors.unexpected');
    }
  }

  private toDomainAnswer(prismaData: Prisma.AnswerGetPayload<object>): Answer {
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
