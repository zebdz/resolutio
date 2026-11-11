/** Participant persistence preserves supplied identities and audit instants.
 * Snapshot history must retain its participant reference regardless of row order. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { expect, it, vi } from 'vitest';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { Poll } from '@/domain/poll/Poll';
import { PollState } from '@/domain/poll/PollState';
import {
  PollId,
  UserId,
  ParticipantId,
  ParticipantWeightHistoryId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { Prisma } from '@/generated/prisma/client';
import { Vote } from '@/domain/poll/Vote';
import { VoteId, QuestionId, AnswerId } from '@/domain/shared/EntityIds';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';

function participant(suffix: string) {
  const result = PollParticipant.create(
    PollId.parse('poll-1'),
    UserId.parse(`user-${suffix}`),
    testCreation(ParticipantId, `participant-${suffix}`),
    VotingWeight.parse(2.5)
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

function history(voter: PollParticipant) {
  const result = ParticipantWeightHistory.create(
    voter.id,
    voter.pollId,
    voter.userId,
    VotingWeight.parse(0),
    voter.userWeight,
    UserId.parse('admin-1'),
    testCreation(ParticipantWeightHistoryId, `history-${voter.id}`)
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

function row(voter: PollParticipant) {
  return {
    id: voter.id,
    pollId: voter.pollId,
    userId: voter.userId,
    userWeight: new Prisma.Decimal(voter.userWeight),
    willingToSignProtocol: null,
    receiptSecret: null,
    snapshotAt: voter.snapshotAt,
    createdAt: voter.createdAt,
  };
}

it('writes participant and history identities and times before database defaults', async () => {
  const voter = participant('1');
  const entry = history(voter);
  const prisma = {
    pollParticipant: { createMany: vi.fn() },
    participantWeightHistory: {
      create: vi.fn(async ({ data }) => ({
        ...data,
        id: data.id ?? 'database-id',
        changedAt: data.changedAt ?? new Date(),
      })),
    },
  };
  const repo = new PrismaParticipantRepository(prisma as any);
  expect((await repo.createParticipants([voter])).success).toBe(true);
  expect(
    prisma.pollParticipant.createMany.mock.calls[0][0].data[0]
  ).toMatchObject({ id: voter.id, createdAt: voter.createdAt });
  const saved = await repo.createWeightHistory(entry);
  expect(saved.success).toBe(true);

  if (!saved.success) {
    throw new Error(saved.error);
  }

  expect(saved.value.id).toBe(entry.id);
  expect(saved.value.changedAt).toEqual(entry.changedAt);
});

it('retains history references when the database returns snapshot participants in another order', async () => {
  const first = participant('1');
  const second = participant('2');
  const entries = [history(first), history(second)];
  const poll = {
    id: first.pollId,
    revision: 0,
    state: PollState.READY,
  } as Poll;
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: poll.id }]),
    poll: {
      findUniqueOrThrow: vi.fn(async () => ({
        revision: 0,
        state: 'SUBMITTED',
      })),
      update: vi.fn(),
    },
    pollParticipant: {
      createMany: vi.fn(),
      findMany: vi.fn(async () => [row(second), row(first)]),
    },
    participantWeightHistory: { createMany: vi.fn() },
  };
  const repo = new PrismaParticipantRepository({
    $transaction: async (operation: any) => operation(tx),
  } as any);
  expect(
    (await repo.executeActivation(poll, [first, second], entries)).success
  ).toBe(true);
  expect(tx.participantWeightHistory.createMany.mock.calls[0][0].data).toEqual(
    entries.map((entry) =>
      expect.objectContaining({
        id: entry.id,
        participantId: entry.participantId,
        userId: entry.userId,
        changedAt: entry.changedAt,
      })
    )
  );
  expect(tx.pollParticipant.createMany.mock.calls[0][0].data).toEqual(
    [first, second].map((voter) =>
      expect.objectContaining({ id: voter.id, createdAt: voter.createdAt })
    )
  );
});

it('preserves application identities through the atomic open-poll ballot path', async () => {
  const voterResult = PollParticipant.create(
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    testCreation(ParticipantId, 'participant-1')
  );

  if (!voterResult.success) {
    throw new Error(voterResult.error);
  }

  const voter = voterResult.value;
  const entry = history(voter);
  const voteResult = Vote.create(
    QuestionId.parse('q1'),
    AnswerId.parse('a1'),
    voter.userId,
    VotingWeight.parse(1),
    testCreation(VoteId, 'vote-1')
  );

  if (!voteResult.success) {
    throw new Error(voteResult.error);
  }

  const vote = voteResult.value;
  let persisted = row(voter);
  let savedVotes: any[] = [];
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: voter.pollId }]),
    poll: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: voter.pollId,
        title: 'Poll',
        state: 'ACTIVE',
        pollType: 'OPEN',
        archivedAt: null,
        organization: { archivedAt: null },
        board: null,
        questions: [
          {
            id: 'q1',
            text: 'Question',
            questionType: 'single-choice',
            answers: [{ id: 'a1', text: 'Answer' }],
          },
        ],
      })),
    },
    user: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: voter.userId,
        confirmedAt: new Date(),
      })),
    },
    pollParticipant: {
      findUnique: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => persisted),
      upsert: vi.fn(
        async ({ create }) =>
          (persisted = {
            ...row(voter),
            ...create,
            id: create.id ?? 'database-participant',
          })
      ),
      update: vi.fn(),
    },
    participantWeightHistory: { create: vi.fn() },
    vote: {
      findFirst: vi.fn(async () => null),
      createMany: vi.fn(async ({ data }) => {
        savedVotes = data;
      }),
      findMany: vi.fn(async () =>
        savedVotes.map((saved) => ({
          ...saved,
          question: { text: 'Question' },
          answer: { text: 'Answer' },
        }))
      ),
    },
  };
  const repo = new PrismaParticipantRepository({
    $transaction: async (operation: any) => operation(tx),
  } as any);
  const result = await repo.joinAndVote(
    voter,
    entry,
    [vote],
    true,
    ReceiptSecret.parse('ab'.repeat(32))
  );
  expect(result.success).toBe(true);
  expect(tx.pollParticipant.upsert.mock.calls[0][0].create).toMatchObject({
    id: voter.id,
    createdAt: voter.createdAt,
  });
  expect(
    tx.participantWeightHistory.create.mock.calls[0][0].data
  ).toMatchObject({
    id: entry.id,
    participantId: voter.id,
    changedAt: entry.changedAt,
  });
  expect(savedVotes[0]).toMatchObject({
    id: vote.id,
    createdAt: vote.createdAt,
  });

  if (!result.success || result.value.kind !== 'original') {
    throw new Error('Expected original ballot');
  }

  expect(result.value.snapshot.votes[0]).toMatchObject({
    weight: '1.000000',
    castAt: vote.createdAt.toISOString(),
  });
});

it('keeps the previous weight when its audit entry cannot be saved', async () => {
  const voter = participant('1');
  const entry = history(voter);
  let persistedWeight = 1;
  const prisma = {
    $transaction: async (operation: any) => {
      let stagedWeight = persistedWeight;
      await operation({
        $queryRaw: async () => [{ id: voter.pollId }],
        poll: { findUniqueOrThrow: async () => ({ state: 'READY' }) },
        vote: { count: async () => 0 },
        pollParticipant: {
          update: async ({ data }: any) => {
            stagedWeight = Number(data.userWeight);
          },
        },
        participantWeightHistory: {
          create: async () => {
            throw new Error('audit unavailable');
          },
        },
      });
      persistedWeight = stagedWeight;
    },
  };
  const repo = new PrismaParticipantRepository(prisma as any);
  expect((await repo.updateParticipantWeight(voter, entry)).success).toBe(
    false
  );
  expect(persistedWeight).toBe(1);
});
