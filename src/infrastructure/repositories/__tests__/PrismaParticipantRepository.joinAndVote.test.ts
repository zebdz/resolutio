import { describe, it, expect, vi } from 'vitest';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { Vote } from '@/domain/poll/Vote';

function buildArgs() {
  const participant = PollParticipant.create('poll-1', 'user-1', 1).value;
  const history = ParticipantWeightHistory.create(
    '',
    'poll-1',
    'user-1',
    0,
    1,
    'user-1',
    'open-poll-join'
  ).value;
  const votes = [Vote.create('question-1', 'answer-1', 'user-1', 1).value];

  return { participant, history, votes };
}

describe('PrismaParticipantRepository.joinAndVote', () => {
  it('upserts the participant, writes history with its id and creates the votes', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'participant-1' });
    const historyCreate = vi.fn().mockResolvedValue({});
    const voteCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    const tx = {
      pollParticipant: { upsert },
      participantWeightHistory: { create: historyCreate },
      vote: { createMany: voteCreateMany },
    };

    const prisma = {
      $transaction: vi.fn().mockImplementation((fn: any) => fn(tx)),
    } as any;

    const repository = new PrismaParticipantRepository(prisma);
    const { participant, history, votes } = buildArgs();

    const result = await repository.joinAndVote(
      participant,
      history,
      votes,
      true
    );

    expect(result.success).toBe(true);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pollId_userId: { pollId: 'poll-1', userId: 'user-1' } },
        update: { willingToSignProtocol: true },
      })
    );
    expect(historyCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participantId: 'participant-1',
          changedBy: 'user-1',
          reason: 'open-poll-join',
        }),
      })
    );
    expect(voteCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            questionId: 'question-1',
            answerId: 'answer-1',
            userId: 'user-1',
          }),
        ],
      })
    );
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
      false
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('common.errors.unexpected');
  });
});
