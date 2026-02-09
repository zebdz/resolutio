import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollState } from '../../../domain/poll/PollState';

// Mock Prisma Decimal
const mockDecimal = (value: number) => ({ toNumber: () => value });

function makePrismaParticipant(overrides: Record<string, any> = {}) {
  return {
    id: 'part-1',
    pollId: 'poll-1',
    userId: 'user-1',
    userWeight: mockDecimal(1.0),
    snapshotAt: new Date('2024-06-01'),
    createdAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function makePrismaWeightHistory(overrides: Record<string, any> = {}) {
  return {
    id: 'wh-1',
    participantId: 'part-1',
    pollId: 'poll-1',
    userId: 'user-1',
    oldWeight: mockDecimal(1.0),
    newWeight: mockDecimal(2.0),
    changedBy: 'admin-1',
    reason: 'initial',
    changedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function createActivePoll(id: string): Poll {
  const pollResult = Poll.create(
    'Test Poll',
    'Test Description',
    'org-1',
    'board-1',
    'admin-1',
    new Date('2024-01-01'),
    new Date('2024-12-31')
  );
  const poll = pollResult.value as Poll;
  (poll as any).props.id = id;

  const questionResult = Question.create('Q1', id, 1, 1, 'single-choice');
  const question = questionResult.value as Question;
  (question as any).props.id = 'question-1';
  const answerResult = Answer.create('A1', 1, question.id);
  question.addAnswer(answerResult.value as Answer);
  poll.addQuestion(question);
  poll.takeSnapshot();
  poll.activate();

  return poll;
}

function createMockPrisma() {
  const tx = {
    pollParticipant: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    participantWeightHistory: {
      createMany: vi.fn(),
    },
    poll: {
      update: vi.fn(),
    },
  };

  return {
    pollParticipant: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    participantWeightHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(tx)),
    _tx: tx,
  } as any;
}

describe('PrismaParticipantRepository', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let repo: PrismaParticipantRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new PrismaParticipantRepository(prisma);
  });

  describe('executeActivation', () => {
    it('creates participants, fetches IDs, creates history, updates poll', async () => {
      const poll = createActivePoll('poll-1');

      const p1 = PollParticipant.reconstitute({
        id: '',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 1.0,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });
      const p2 = PollParticipant.reconstitute({
        id: '',
        pollId: 'poll-1',
        userId: 'user-2',
        userWeight: 2.0,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });

      const h1 = ParticipantWeightHistory.reconstitute({
        id: '',
        participantId: '',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 0,
        newWeight: 1.0,
        changedBy: 'system',
        reason: 'activation',
        changedAt: new Date(),
      });
      const h2 = ParticipantWeightHistory.reconstitute({
        id: '',
        participantId: '',
        pollId: 'poll-1',
        userId: 'user-2',
        oldWeight: 0,
        newWeight: 2.0,
        changedBy: 'system',
        reason: 'activation',
        changedAt: new Date(),
      });

      // Mock tx responses
      const createdPrismaParticipants = [
        makePrismaParticipant({
          id: 'part-db-1',
          userId: 'user-1',
          userWeight: mockDecimal(1.0),
        }),
        makePrismaParticipant({
          id: 'part-db-2',
          userId: 'user-2',
          userWeight: mockDecimal(2.0),
        }),
      ];

      prisma._tx.pollParticipant.createMany.mockResolvedValue({ count: 2 });
      prisma._tx.pollParticipant.findMany.mockResolvedValue(
        createdPrismaParticipants
      );
      prisma._tx.participantWeightHistory.createMany.mockResolvedValue({
        count: 2,
      });
      prisma._tx.poll.update.mockResolvedValue({});

      const result = await repo.executeActivation(poll, [p1, p2], [h1, h2]);

      expect(result.success).toBe(true);
      const participants = result.value as PollParticipant[];
      expect(participants).toHaveLength(2);
      expect(participants[0].id).toBe('part-db-1');
      expect(participants[1].id).toBe('part-db-2');
    });

    it('maps history records to created participant IDs by index', async () => {
      const poll = createActivePoll('poll-1');

      const p1 = PollParticipant.reconstitute({
        id: '',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 1.5,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });

      const h1 = ParticipantWeightHistory.reconstitute({
        id: '',
        participantId: 'placeholder',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 0,
        newWeight: 1.5,
        changedBy: 'system',
        reason: 'activation',
        changedAt: new Date(),
      });

      const createdPrismaParticipants = [
        makePrismaParticipant({
          id: 'real-part-id',
          userId: 'user-1',
          userWeight: mockDecimal(1.5),
        }),
      ];

      prisma._tx.pollParticipant.createMany.mockResolvedValue({ count: 1 });
      prisma._tx.pollParticipant.findMany.mockResolvedValue(
        createdPrismaParticipants
      );
      prisma._tx.participantWeightHistory.createMany.mockResolvedValue({
        count: 1,
      });
      prisma._tx.poll.update.mockResolvedValue({});

      await repo.executeActivation(poll, [p1], [h1]);

      // Verify history was created with the real participant ID (from index mapping)
      const historyCall =
        prisma._tx.participantWeightHistory.createMany.mock.calls[0][0];
      expect(historyCall.data[0].participantId).toBe('real-part-id');
    });

    it('skips participant creation when list is empty', async () => {
      const poll = createActivePoll('poll-1');

      prisma._tx.pollParticipant.findMany.mockResolvedValue([]);
      prisma._tx.poll.update.mockResolvedValue({});

      const result = await repo.executeActivation(poll, [], []);

      expect(result.success).toBe(true);
      expect(prisma._tx.pollParticipant.createMany).not.toHaveBeenCalled();
      expect(
        prisma._tx.participantWeightHistory.createMany
      ).not.toHaveBeenCalled();
    });

    it('returns failure on transaction error', async () => {
      const poll = createActivePoll('poll-1');

      prisma.$transaction.mockRejectedValue(new Error('tx failed'));

      const result = await repo.executeActivation(poll, [], []);

      expect(result.success).toBe(false);
    });
  });

  describe('getParticipants', () => {
    it('reconstitutes PollParticipant with Decimal → number', async () => {
      prisma.pollParticipant.findMany.mockResolvedValue([
        makePrismaParticipant({ id: 'p-1', userWeight: mockDecimal(3.14) }),
        makePrismaParticipant({
          id: 'p-2',
          userId: 'user-2',
          userWeight: mockDecimal(0.5),
        }),
      ]);

      const result = await repo.getParticipants('poll-1');

      expect(result.success).toBe(true);
      const participants = result.value as PollParticipant[];
      expect(participants).toHaveLength(2);
      expect(participants[0].id).toBe('p-1');
      expect(participants[0].userWeight).toBe(3.14);
      expect(typeof participants[0].userWeight).toBe('number');
      expect(participants[1].userWeight).toBe(0.5);
    });

    it('returns empty array when no participants', async () => {
      prisma.pollParticipant.findMany.mockResolvedValue([]);

      const result = await repo.getParticipants('poll-1');

      expect(result.success).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('returns failure on db error', async () => {
      prisma.pollParticipant.findMany.mockRejectedValue(new Error('db down'));

      const result = await repo.getParticipants('poll-1');

      expect(result.success).toBe(false);
    });
  });

  describe('updateParticipantWeight', () => {
    it('calls update with Decimal-converted weight', async () => {
      prisma.pollParticipant.update.mockResolvedValue({});

      const participant = PollParticipant.reconstitute({
        id: 'part-1',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 4.2,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });

      const result = await repo.updateParticipantWeight(participant);

      expect(result.success).toBe(true);
      expect(prisma.pollParticipant.update).toHaveBeenCalledOnce();
      const callArgs = prisma.pollParticipant.update.mock.calls[0][0];
      expect(callArgs.where.id).toBe('part-1');
      // userWeight should be a Prisma.Decimal instance (has toNumber, toString, etc.)
      expect(callArgs.data.userWeight).toBeDefined();
    });

    it('returns failure on db error', async () => {
      prisma.pollParticipant.update.mockRejectedValue(new Error('constraint'));

      const participant = PollParticipant.reconstitute({
        id: 'part-1',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 1.0,
        snapshotAt: new Date(),
        createdAt: new Date(),
      });

      const result = await repo.updateParticipantWeight(participant);

      expect(result.success).toBe(false);
    });
  });

  describe('createWeightHistory', () => {
    it('creates and reconstitutes weight history with Decimal → number', async () => {
      const prismaHistory = makePrismaWeightHistory({
        id: 'wh-created',
        oldWeight: mockDecimal(1.0),
        newWeight: mockDecimal(3.0),
      });
      prisma.participantWeightHistory.create.mockResolvedValue(prismaHistory);

      const history = ParticipantWeightHistory.reconstitute({
        id: '',
        participantId: 'part-1',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 1.0,
        newWeight: 3.0,
        changedBy: 'admin-1',
        reason: 'adjustment',
        changedAt: new Date(),
      });

      const result = await repo.createWeightHistory(history);

      expect(result.success).toBe(true);
      const created = result.value as ParticipantWeightHistory;
      expect(created.id).toBe('wh-created');
      expect(created.oldWeight).toBe(1.0);
      expect(created.newWeight).toBe(3.0);
      expect(typeof created.oldWeight).toBe('number');
      expect(typeof created.newWeight).toBe('number');
    });

    it('returns failure on db error', async () => {
      prisma.participantWeightHistory.create.mockRejectedValue(
        new Error('db down')
      );

      const history = ParticipantWeightHistory.reconstitute({
        id: '',
        participantId: 'part-1',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 1.0,
        newWeight: 2.0,
        changedBy: 'admin-1',
        reason: null,
        changedAt: new Date(),
      });

      const result = await repo.createWeightHistory(history);

      expect(result.success).toBe(false);
    });
  });

  describe('getParticipantById', () => {
    it('returns reconstituted participant when found', async () => {
      prisma.pollParticipant.findUnique.mockResolvedValue(
        makePrismaParticipant({ id: 'p-1', userWeight: mockDecimal(2.0) })
      );

      const result = await repo.getParticipantById('p-1');

      expect(result.success).toBe(true);
      const participant = result.value as PollParticipant;
      expect(participant.id).toBe('p-1');
      expect(participant.userWeight).toBe(2.0);
    });

    it('returns null when not found', async () => {
      prisma.pollParticipant.findUnique.mockResolvedValue(null);

      const result = await repo.getParticipantById('nonexistent');

      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('getParticipantByUserAndPoll', () => {
    it('returns reconstituted participant for user+poll', async () => {
      prisma.pollParticipant.findUnique.mockResolvedValue(
        makePrismaParticipant({ id: 'p-1' })
      );

      const result = await repo.getParticipantByUserAndPoll('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect((result.value as PollParticipant).id).toBe('p-1');
    });

    it('returns null when no match', async () => {
      prisma.pollParticipant.findUnique.mockResolvedValue(null);

      const result = await repo.getParticipantByUserAndPoll('poll-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('getWeightHistory', () => {
    it('reconstitutes history records with Decimal → number', async () => {
      prisma.participantWeightHistory.findMany.mockResolvedValue([
        makePrismaWeightHistory({
          id: 'wh-1',
          oldWeight: mockDecimal(1.0),
          newWeight: mockDecimal(2.0),
        }),
        makePrismaWeightHistory({
          id: 'wh-2',
          oldWeight: mockDecimal(2.0),
          newWeight: mockDecimal(3.5),
        }),
      ]);

      const result = await repo.getWeightHistory('poll-1');

      expect(result.success).toBe(true);
      const history = result.value as ParticipantWeightHistory[];
      expect(history).toHaveLength(2);
      expect(history[0].oldWeight).toBe(1.0);
      expect(history[1].newWeight).toBe(3.5);
    });
  });
});
