import { PrismaClient } from '@/generated/prisma/client';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaDraftRepository implements DraftRepository {
  constructor(private prisma: PrismaClient) {}

  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    try {
      const created = await this.prisma.voteDraft.upsert({
        where: {
          pollId_questionId_userId_answerId: {
            pollId: draft.pollId,
            questionId: draft.questionId,
            userId: draft.userId,
            answerId: draft.answerId,
          },
        },
        create: {
          pollId: draft.pollId,
          questionId: draft.questionId,
          answerId: draft.answerId,
          userId: draft.userId,
        },
        update: {
          updatedAt: new Date(),
        },
      });

      return success(this.toDomainDraft(created));
    } catch (error) {
      console.error('Failed to save draft:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    try {
      const drafts = await this.prisma.voteDraft.findMany({
        where: {
          pollId,
          userId,
        },
        orderBy: { updatedAt: 'desc' },
      });

      return success(drafts.map((d) => this.toDomainDraft(d)));
    } catch (error) {
      console.error('Failed to get user drafts:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete user drafts:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: { pollId },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete all poll drafts:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          questionId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete drafts by question:', error);

      return failure('common.errors.unexpected');
    }
  }

  async deleteDraftByAnswer(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Promise<Result<void, string>> {
    try {
      await this.prisma.voteDraft.deleteMany({
        where: {
          pollId,
          questionId,
          answerId,
          userId,
        },
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to delete draft by answer:', error);

      return failure('common.errors.unexpected');
    }
  }

  private toDomainDraft(prismaData: any): VoteDraft {
    return VoteDraft.reconstitute({
      id: prismaData.id,
      pollId: prismaData.pollId,
      questionId: prismaData.questionId,
      answerId: prismaData.answerId,
      userId: prismaData.userId,
      createdAt: prismaData.createdAt,
      updatedAt: prismaData.updatedAt,
    });
  }
}
