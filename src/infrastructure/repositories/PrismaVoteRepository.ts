import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Vote } from '../../domain/poll/Vote';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaVoteRepository implements VoteRepository {
  constructor(private prisma: PrismaClient) {}

  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    try {
      const created = await this.prisma.vote.create({
        data: {
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
        },
      });

      return success(this.toDomainVote(created));
    } catch (error) {
      return failure(`Failed to create vote: ${error}`);
    }
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    try {
      await this.prisma.vote.createMany({
        data: votes.map((vote) => ({
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
        })),
      });

      return success(undefined);
    } catch (error) {
      return failure(`Failed to create votes: ${error}`);
    }
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    try {
      const votes = await this.prisma.vote.findMany({
        where: {
          userId,
          question: {
            pollId,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(votes.map((v) => this.toDomainVote(v)));
    } catch (error) {
      return failure(`Failed to get user votes: ${error}`);
    }
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    try {
      // Get count of non-archived questions in poll
      const totalQuestions = await this.prisma.question.count({
        where: {
          pollId,
          archivedAt: null,
        },
      });

      if (totalQuestions === 0) {
        return success(false);
      }

      // Get count of distinct questions user has voted on
      const votedQuestions = await this.prisma.vote.groupBy({
        by: ['questionId'],
        where: {
          userId,
          question: {
            pollId,
            archivedAt: null,
          },
        },
      });

      return success(votedQuestions.length === totalQuestions);
    } catch (error) {
      return failure(`Failed to check if user finished voting: ${error}`);
    }
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    try {
      const votes = await this.prisma.vote.findMany({
        where: {
          question: {
            pollId,
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(votes.map((v) => this.toDomainVote(v)));
    } catch (error) {
      return failure(`Failed to get votes by poll: ${error}`);
    }
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    try {
      const voteCount = await this.prisma.vote.count({
        where: {
          question: {
            pollId: pollId,
          },
        },
      });

      return success(voteCount > 0);
    } catch (error) {
      return failure(`Failed to check poll votes: ${error}`);
    }
  }

  private toDomainVote(prismaData: any): Vote {
    return Vote.reconstitute({
      id: prismaData.id,
      questionId: prismaData.questionId,
      answerId: prismaData.answerId,
      userId: prismaData.userId,
      userWeight: prismaData.userWeight.toNumber(),
      createdAt: prismaData.createdAt,
    });
  }
}
