import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaVoteRepository } from '../PrismaVoteRepository';
import { Vote } from '../../../domain/poll/Vote';

// Mock Prisma Decimal
const mockDecimal = (value: number) => ({ toNumber: () => value });

function makePrismaVote(overrides: Record<string, any> = {}) {
  return {
    id: 'vote-1',
    questionId: 'q-1',
    answerId: 'a-1',
    userId: 'user-1',
    userWeight: mockDecimal(1.5),
    createdAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    vote: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    question: {
      count: vi.fn(),
    },
  } as any;
}

describe('PrismaVoteRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repo: PrismaVoteRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new PrismaVoteRepository(prisma);
  });

  describe('hasUserFinishedVoting', () => {
    it('returns true when user voted on all questions', async () => {
      prisma.question.count.mockResolvedValue(2);
      prisma.vote.groupBy.mockResolvedValue([
        { questionId: 'q-1' },
        { questionId: 'q-2' },
      ]);

      const result = await repo.hasUserFinishedVoting('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('returns false when user voted on some questions', async () => {
      prisma.question.count.mockResolvedValue(3);
      prisma.vote.groupBy.mockResolvedValue([{ questionId: 'q-1' }]);

      const result = await repo.hasUserFinishedVoting('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('returns false when user voted on no questions', async () => {
      prisma.question.count.mockResolvedValue(2);
      prisma.vote.groupBy.mockResolvedValue([]);

      const result = await repo.hasUserFinishedVoting('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('returns false when poll has zero questions', async () => {
      prisma.question.count.mockResolvedValue(0);

      const result = await repo.hasUserFinishedVoting('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
      // groupBy should not be called when totalQuestions is 0
      expect(prisma.vote.groupBy).not.toHaveBeenCalled();
    });

    it('returns failure on db error', async () => {
      prisma.question.count.mockRejectedValue(new Error('db down'));

      const result = await repo.hasUserFinishedVoting('poll-1', 'user-1');

      expect(result.success).toBe(false);
    });
  });

  describe('pollHasVotes', () => {
    it('returns true when votes exist', async () => {
      prisma.vote.count.mockResolvedValue(5);

      const result = await repo.pollHasVotes('poll-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
    });

    it('returns false when no votes exist', async () => {
      prisma.vote.count.mockResolvedValue(0);

      const result = await repo.pollHasVotes('poll-1');

      expect(result.success).toBe(true);
      expect(result.value).toBe(false);
    });

    it('returns failure on db error', async () => {
      prisma.vote.count.mockRejectedValue(new Error('db down'));

      const result = await repo.pollHasVotes('poll-1');

      expect(result.success).toBe(false);
    });
  });

  describe('getVotesByPoll', () => {
    it('reconstitutes Vote domain objects with Decimal → number', async () => {
      const prismaVotes = [
        makePrismaVote({ id: 'v-1', userWeight: mockDecimal(2.5) }),
        makePrismaVote({
          id: 'v-2',
          questionId: 'q-2',
          answerId: 'a-2',
          userWeight: mockDecimal(0.75),
        }),
      ];
      prisma.vote.findMany.mockResolvedValue(prismaVotes);

      const result = await repo.getVotesByPoll('poll-1');

      expect(result.success).toBe(true);
      const votes = result.value as Vote[];
      expect(votes).toHaveLength(2);

      expect(votes[0].id).toBe('v-1');
      expect(votes[0].userWeight).toBe(2.5);
      expect(typeof votes[0].userWeight).toBe('number');

      expect(votes[1].id).toBe('v-2');
      expect(votes[1].userWeight).toBe(0.75);
      expect(typeof votes[1].userWeight).toBe('number');
    });

    it('returns empty array when no votes', async () => {
      prisma.vote.findMany.mockResolvedValue([]);

      const result = await repo.getVotesByPoll('poll-1');

      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('returns failure on db error', async () => {
      prisma.vote.findMany.mockRejectedValue(new Error('db down'));

      const result = await repo.getVotesByPoll('poll-1');

      expect(result.success).toBe(false);
    });
  });

  describe('createVotes', () => {
    it('creates multiple votes via createMany', async () => {
      prisma.vote.createMany.mockResolvedValue({ count: 2 });

      const vote1 = Vote.reconstitute({
        id: 'v-1',
        questionId: 'q-1',
        answerId: 'a-1',
        userId: 'user-1',
        userWeight: 1.0,
        createdAt: new Date(),
      });
      const vote2 = Vote.reconstitute({
        id: 'v-2',
        questionId: 'q-2',
        answerId: 'a-2',
        userId: 'user-1',
        userWeight: 2.0,
        createdAt: new Date(),
      });

      const result = await repo.createVotes([vote1, vote2]);

      expect(result.success).toBe(true);
      expect(prisma.vote.createMany).toHaveBeenCalledOnce();

      const callData = prisma.vote.createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(2);
      expect(callData[0].questionId).toBe('q-1');
      expect(callData[1].questionId).toBe('q-2');
    });

    it('returns failure on db error', async () => {
      prisma.vote.createMany.mockRejectedValue(new Error('constraint'));

      const vote = Vote.reconstitute({
        id: 'v-1',
        questionId: 'q-1',
        answerId: 'a-1',
        userId: 'user-1',
        userWeight: 1.0,
        createdAt: new Date(),
      });

      const result = await repo.createVotes([vote]);

      expect(result.success).toBe(false);
    });
  });

  describe('createVote', () => {
    it('creates single vote and reconstitutes result', async () => {
      const prismaVote = makePrismaVote({
        id: 'v-created',
        userWeight: mockDecimal(1.0),
      });
      prisma.vote.create.mockResolvedValue(prismaVote);

      const vote = Vote.reconstitute({
        id: '',
        questionId: 'q-1',
        answerId: 'a-1',
        userId: 'user-1',
        userWeight: 1.0,
        createdAt: new Date(),
      });

      const result = await repo.createVote(vote);

      expect(result.success).toBe(true);
      const created = result.value as Vote;
      expect(created.id).toBe('v-created');
      expect(created.userWeight).toBe(1.0);
    });
  });

  describe('getUserVotes', () => {
    it('returns reconstituted votes for a user in a poll', async () => {
      prisma.vote.findMany.mockResolvedValue([
        makePrismaVote({ id: 'v-1', userWeight: mockDecimal(3.0) }),
      ]);

      const result = await repo.getUserVotes('poll-1', 'user-1');

      expect(result.success).toBe(true);
      const votes = result.value as Vote[];
      expect(votes).toHaveLength(1);
      expect(votes[0].userWeight).toBe(3.0);
    });
  });
});
