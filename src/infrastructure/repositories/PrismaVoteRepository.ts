/** Reads persisted selections and preserves explicit cast times on legacy insert
 * APIs. Ballot acceptance uses the participant transaction; SQL guards the cutoff. */
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Vote } from '../../domain/poll/Vote';
import { PollId, UserId } from '@/domain/shared/EntityIds';
import {
  VoteRepository,
  VoteRepositoryFailure,
} from '../../domain/poll/VoteRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export class PrismaVoteRepository implements VoteRepository {
  constructor(private prisma: PrismaClient) {}

  async createVote(vote: Vote): Promise<Result<Vote, VoteRepositoryFailure>> {
    try {
      const created = await this.prisma.vote.create({
        data: {
          id: vote.id,
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
          createdAt: vote.createdAt,
        },
      });

      return success(this.toDomainVote(created));
    } catch (error) {
      console.error('Failed to create vote:', error);

      return failure('common.errors.unexpected');
    }
  }

  async createVotes(
    votes: Vote[]
  ): Promise<Result<void, VoteRepositoryFailure>> {
    try {
      await this.prisma.vote.createMany({
        data: votes.map((vote) => ({
          id: vote.id,
          questionId: vote.questionId,
          answerId: vote.answerId,
          userId: vote.userId,
          userWeight: new Prisma.Decimal(vote.userWeight),
          createdAt: vote.createdAt,
        })),
      });

      return success(undefined);
    } catch (error) {
      console.error('Failed to create votes:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getUserVotes(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<Vote[], VoteRepositoryFailure>> {
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
      console.error('Failed to get user votes:', error);

      return failure('common.errors.unexpected');
    }
  }

  async hasUserFinishedVoting(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<boolean, VoteRepositoryFailure>> {
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
      console.error('Failed to check if user finished voting:', error);

      return failure('common.errors.unexpected');
    }
  }

  async getVotesByPoll(
    pollId: PollId
  ): Promise<Result<Vote[], VoteRepositoryFailure>> {
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
      console.error('Failed to get votes by poll:', error);

      return failure('common.errors.unexpected');
    }
  }

  async pollHasVotes(
    pollId: PollId
  ): Promise<Result<boolean, VoteRepositoryFailure>> {
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
      console.error('Failed to check poll votes:', error);

      return failure('common.errors.unexpected');
    }
  }

  private toDomainVote(prismaData: Prisma.VoteGetPayload<object>): Vote {
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
