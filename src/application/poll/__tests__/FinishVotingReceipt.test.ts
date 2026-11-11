/** Receipt retries must use committed cast data even after the poll finishes.
 * Post-commit cleanup failures must never turn a successful cast into failure. */
import { expect, it, vi } from 'vitest';
import { FinishVotingUseCase } from '../FinishVotingUseCase';
import { BallotSnapshot } from '@/domain/poll/BallotSnapshot';
import { success, failure } from '@/domain/shared/Result';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { Instant } from '@/domain/shared/Instant';
import { IdGenerator } from '@/application/shared/EntityCreation';

const ids: IdGenerator = { generate: (schema) => schema.parse('assigned-1') };

const snapshot = BallotSnapshot.parse({
  version: 1,
  pollId: 'poll-1',
  userId: 'user-1',
  receiptSecret: 'ab'.repeat(32),
  pollTitle: 'Original title',
  votes: [
    {
      questionId: 'q1',
      answerId: 'a1',
      weight: '1.000000',
      castAt: '2026-10-26T10:00:00.123Z',
      questionText: 'Original question',
      answerText: 'Original answer',
    },
  ],
});

it('returns the original receipt without consulting live labels, state or drafts', async () => {
  const secretGenerator = {
    generate: vi.fn(() => ReceiptSecret.parse('cd'.repeat(32))),
  };
  const polls = { getPollById: vi.fn() };
  const participants = {
    getCastBallot: vi
      .fn()
      .mockResolvedValue(success({ kind: 'original', snapshot })),
  };
  const useCase = new FinishVotingUseCase(
    polls as any,
    participants as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    secretGenerator,
    ids,
    { now: () => Instant.parse('2026-10-26T10:00:00.123Z') }
  );
  const first = await useCase.execute({
    pollId: 'poll-1',
    userId: 'user-1',
    willingToSignProtocol: false,
  });
  const replay = await useCase.execute({
    pollId: 'poll-1',
    userId: 'user-1',
    willingToSignProtocol: true,
  });
  expect(first.success).toBe(true);

  if (!first.success || first.value.kind !== 'original') {
    throw new Error('Expected original receipt');
  }

  expect(first.value.receipt.pollTitle).toBe('Original title');
  expect(first.value.receipt.leaves[0].preimage.castAt).toBe(
    snapshot.votes[0].castAt
  );
  expect(replay).toEqual(first);
  expect(secretGenerator.generate).not.toHaveBeenCalled();
  expect(polls.getPollById).not.toHaveBeenCalled();
});

it.each(['failure', 'throw'])(
  'keeps a committed receipt when draft cleanup returns %s',
  async (mode) => {
    const participant = PollParticipant.reconstitute({
      id: 'p1',
      pollId: 'poll-1',
      userId: 'user-1',
      userWeight: 1,
      willingToSignProtocol: null,
      snapshotAt: new Date(),
      createdAt: new Date(),
    });
    const participants = {
      getCastBallot: vi.fn().mockResolvedValue(success(null)),
      getParticipantByUserAndPoll: vi
        .fn()
        .mockResolvedValue(success(participant)),
      castVotes: vi
        .fn()
        .mockResolvedValue(success({ kind: 'original', snapshot })),
    };
    const poll = {
      id: 'poll-1',
      organizationId: 'org-1',
      boardId: null,
      state: 'ACTIVE',
      isArchived: () => false,
      isOpen: () => false,
      isActive: () => true,
      isFinished: () => false,
      questions: [
        {
          id: 'q1',
          questionType: 'single-choice',
          isArchived: () => false,
          answers: [{ id: 'a1', isArchived: () => false }],
        },
      ],
    };
    const drafts = {
      getUserDrafts: vi
        .fn()
        .mockResolvedValue(success([{ questionId: 'q1', answerId: 'a1' }])),
      deleteUserDrafts:
        mode === 'throw'
          ? vi.fn().mockRejectedValue(new Error('cleanup unavailable'))
          : vi.fn().mockResolvedValue(failure('cleanup unavailable')),
    };
    const now = new Date(snapshot.votes[0].castAt);
    const useCase = new FinishVotingUseCase(
      { getPollById: async () => success(poll) } as any,
      participants as any,
      { hasUserFinishedVoting: async () => success(false) } as any,
      drafts as any,
      { findById: async () => null } as any,
      {} as any,
      {} as any,
      { generate: () => snapshot.receiptSecret },
      ids,
      { now: () => Instant.fromDate(now) }
    );
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      willingToSignProtocol: true,
    });
    expect(result.success).toBe(true);

    if (!result.success || result.value.kind !== 'original') {
      throw new Error('Expected receipt');
    }

    expect(result.value.receipt.receiptSecret).toBe(snapshot.receiptSecret);
    expect(participants.castVotes).toHaveBeenCalledOnce();
    expect(participants.castVotes.mock.calls[0][1][0].createdAt).toEqual(now);
    expect(participants.castVotes.mock.calls[0][1][0].id).toBe('assigned-1');
  }
);
