import { VotingWeight } from '@/domain/poll/VotingWeight';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import {
  PollId,
  QuestionId,
  AnswerId,
  ParticipantId,
  ParticipantWeightHistoryId,
  VoteId,
  VoteDraftId,
  UserId,
  OrganizationId,
  BoardId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
/** Adapter error and replay contracts. Whole-ballot writes, history, rollback
 * and concurrency are exercised against PostgreSQL in AtomicVoting.database.test. */
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { BallotSnapshot } from '@/domain/poll/BallotSnapshot';
import { describe, it, expect, vi } from 'vitest';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { Vote } from '@/domain/poll/Vote';

function buildArgs() {
  const participant = expectSuccess(
    PollParticipant.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      testCreation(ParticipantId, 'participant-1'),
      VotingWeight.parse(1)
    )
  );
  const history = expectSuccess(
    ParticipantWeightHistory.create(
      ParticipantId.parse('participant-1'),
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      VotingWeight.parse(0),
      VotingWeight.parse(1),
      UserId.parse('user-1'),
      testCreation(ParticipantWeightHistoryId, 'history-1'),
      'open-poll-join'
    )
  );
  const votes = [
    expectSuccess(
      Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1),
        testCreation(VoteId, 'vote-1')
      )
    ),
  ];

  return { participant, history, votes };
}

describe('PrismaParticipantRepository.joinAndVote', () => {
  it('replays a committed ballot without replacing its secret or signing decision', async () => {
    const secret = ReceiptSecret.parse('ab'.repeat(32));
    const snapshot = BallotSnapshot.parse({
      version: 1,
      pollId: 'poll-1',
      userId: 'user-1',
      receiptSecret: secret,
      pollTitle: 'Original',
      votes: [
        {
          questionId: 'question-1',
          answerId: 'answer-1',
          weight: '1.000000',
          castAt: '2026-10-26T10:00:00.123Z',
          questionText: 'Q',
          answerText: 'A',
        },
      ],
    });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'poll-1' }]),
      pollParticipant: {
        findUnique: vi.fn().mockResolvedValue({
          receiptSecret: secret,
          ballotSnapshot: snapshot,
        }),
      },
    };
    const prisma = { $transaction: vi.fn((fn: any) => fn(tx)) } as any;
    const repository = new PrismaParticipantRepository(prisma);
    const { participant, history, votes } = buildArgs();
    expect(
      await repository.joinAndVote(
        participant,
        history,
        votes,
        false,
        ReceiptSecret.parse('cd'.repeat(32))
      )
    ).toEqual({ success: true, value: { kind: 'original', snapshot } });
  });

  it('returns a failure when the transaction throws', async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Error('duplicate vote')),
    } as any;

    const repository = new PrismaParticipantRepository(prisma);
    const { participant, history, votes } = buildArgs();

    const result = await repository.joinAndVote(
      participant,
      history,
      votes,
      false,
      ReceiptSecret.parse('ab'.repeat(32))
    );

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe('common.errors.unexpected');
  });
});
