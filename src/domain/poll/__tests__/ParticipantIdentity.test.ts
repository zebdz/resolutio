/** Participant clients receive their stable identity and immutable snapshot time
 * before persistence; weight/credential changes must preserve validated state. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { describe, expect, it } from 'vitest';
import { PollParticipant } from '../PollParticipant';
import { ParticipantId, PollId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Participant identity and snapshot values', () => {
  it('rejects a corrupted protocol decision instead of retaining an untyped flag', () => {
    const raw = JSON.parse(
      JSON.stringify({
        id: 'participant-1',
        pollId: 'poll-1',
        userId: 'user-1',
        userWeight: 1,
        willingToSignProtocol: 'yes',
      })
    );
    expect(() =>
      PollParticipant.reconstitute({
        ...raw,
        snapshotAt: new Date(),
        createdAt: new Date(),
      })
    ).toThrow();
  });
  it('preserves valid fractional weights without applying storage rounding', () => {
    const weight = 1 / 3;
    const result = PollParticipant.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      testCreation(ParticipantId, 'participant-1'),
      VotingWeight.parse(weight)
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.userWeight).toBe(weight);
      result.value.createdAt.setUTCFullYear(1999);
      expect(result.value.createdAt.toISOString()).toBe(
        '2026-01-01T00:00:00.000Z'
      );
    }
  });
  it.each([NaN, Infinity, -Infinity, -1, 1_000_000_000])(
    'rejects invalid weight %s before it can become participant state',
    (weight) => {
      const creation = testCreation(ParticipantId, 'participant-1');
      expect(
        PollParticipant.create(
          PollId.parse('poll-1'),
          UserId.parse('user-1'),
          creation,
          // @ts-expect-error Exercise malformed external weight at runtime.
          weight
        )
      ).toEqual({ success: false, error: PollDomainCodes.INVALID_WEIGHT });
      const participant = PollParticipant.create(
        PollId.parse('poll-1'),
        UserId.parse('user-1'),
        creation
      );

      if (!participant.success) {
        throw new Error(participant.error);
      }

      // @ts-expect-error Exercise malformed external weight at runtime.
      expect(participant.value.updateWeight(weight)).toEqual({
        success: false,
        error: PollDomainCodes.INVALID_WEIGHT,
      });
      expect(participant.value.userWeight).toBe(1);
      expect(() =>
        PollParticipant.reconstitute({
          id: 'participant-1',
          pollId: 'poll-1',
          userId: 'user-1',
          userWeight: weight,
          snapshotAt: Instant.toDate(creation.now),
          createdAt: Instant.toDate(creation.now),
          willingToSignProtocol: null,
        })
      ).toThrow(PollDomainCodes.INVALID_WEIGHT);
    }
  );
  it('retains the supplied identity and snapshot time before persistence', () => {
    const creation = testCreation(ParticipantId, 'participant-1');
    const result = PollParticipant.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      creation
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.userWeight).toBe(1);
      expect(result.value.snapshotAt).toEqual(Instant.toDate(creation.now));
      expect(result.value.createdAt).toEqual(Instant.toDate(creation.now));
    }
  });
});
