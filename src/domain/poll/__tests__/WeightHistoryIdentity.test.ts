/** Weight history must already identify its participant before persistence.
 * Application-supplied identity/time make audit records deterministic and immutable. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { describe, expect, it } from 'vitest';
import { ParticipantWeightHistory } from '../ParticipantWeightHistory';
import {
  ParticipantWeightHistoryId,
  ParticipantId,
  PollId,
  UserId,
} from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Weight history identity', () => {
  it('rejects corrupted persisted reason data', () => {
    const raw = JSON.parse(
      JSON.stringify({
        id: 'history-1',
        participantId: 'participant-1',
        pollId: 'poll-1',
        userId: 'user-1',
        oldWeight: 1,
        newWeight: 2,
        changedBy: 'admin-1',
        reason: { text: 'reason' },
      })
    );
    expect(() =>
      ParticipantWeightHistory.reconstitute({ ...raw, changedAt: new Date() })
    ).toThrow();
  });
  it.each([NaN, Infinity, -Infinity, -1, 1_000_000_000])(
    'rejects invalid historical weight %s',
    (weight) => {
      const creation = testCreation(ParticipantWeightHistoryId, 'history-1');

      for (const [oldWeight, newWeight] of [
        [weight, 1],
        [1, weight],
      ]) {
        expect(
          ParticipantWeightHistory.create(
            ParticipantId.parse('participant-1'),
            PollId.parse('poll-1'),
            UserId.parse('user-1'),
            // @ts-expect-error Exercise malformed external weight at runtime.
            oldWeight,
            newWeight,
            UserId.parse('admin-1'),
            creation
          )
        ).toEqual({ success: false, error: PollDomainCodes.INVALID_WEIGHT });
        expect(() =>
          ParticipantWeightHistory.reconstitute({
            id: 'history-1',
            participantId: 'participant-1',
            pollId: 'poll-1',
            userId: 'user-1',
            oldWeight,
            newWeight,
            changedBy: 'admin-1',
            reason: null,
            changedAt: new Date(creation.now),
          })
        ).toThrow(PollDomainCodes.INVALID_WEIGHT);
      }
    }
  );
  it('uses supplied history identity/time and a real participant reference', () => {
    const creation = testCreation(ParticipantWeightHistoryId, 'history-1');
    const result = ParticipantWeightHistory.create(
      ParticipantId.parse('participant-1'),
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      VotingWeight.parse(1),
      VotingWeight.parse(2.5),
      UserId.parse('admin-1'),
      creation,
      'Updated property'
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.participantId).toBe('participant-1');
      expect(result.value.changedAt.toISOString()).toBe(creation.now);
      result.value.changedAt.setFullYear(1999);
      expect(result.value.changedAt.toISOString()).toBe(creation.now);
    }
  });
});
