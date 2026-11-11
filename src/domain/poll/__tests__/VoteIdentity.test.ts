/** Accepted selections keep caller-assigned identity and cast time exactly.
 * These values must survive persistence without altering receipt/seal inputs. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { describe, expect, it } from 'vitest';
import { Vote } from '../Vote';
import { VoteId, QuestionId, AnswerId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Vote identity and cast time', () => {
  it.each([NaN, Infinity, -Infinity, -1, 1_000_000_000])(
    'rejects invalid weight %s during creation and rehydration',
    (weight) => {
      expect(
        Vote.create(
          QuestionId.parse('question-1'),
          AnswerId.parse('answer-1'),
          UserId.parse('user-1'),
          // @ts-expect-error Exercise malformed external weight at runtime.
          weight,
          testCreation(VoteId, 'vote-1')
        )
      ).toEqual({ success: false, error: PollDomainCodes.INVALID_WEIGHT });
      expect(() =>
        Vote.reconstitute({
          id: 'vote-1',
          questionId: 'question-1',
          answerId: 'answer-1',
          userId: 'user-1',
          userWeight: weight,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        })
      ).toThrow(PollDomainCodes.INVALID_WEIGHT);
    }
  );

  it.each(['id', 'questionId', 'answerId', 'userId'])(
    'rejects missing persisted %s',
    (field) => {
      expect(() =>
        Vote.reconstitute({
          id: 'vote-1',
          questionId: 'question-1',
          answerId: 'answer-1',
          userId: 'user-1',
          userWeight: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          [field]: '',
        })
      ).toThrow();
    }
  );
  it('keeps explicit vote identity and the exact supplied cast millisecond', () => {
    const creation = {
      ...testCreation(VoteId, 'vote-1'),
      now: Instant.parse('2026-01-01T00:00:00.123Z'),
    };
    const result = Vote.create(
      QuestionId.parse('question-1'),
      AnswerId.parse('answer-1'),
      UserId.parse('user-1'),
      VotingWeight.parse(2.5),
      creation
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.createdAt.toISOString()).toBe(creation.now);
      result.value.createdAt.setUTCMilliseconds(999);
      expect(result.value.createdAt.toISOString()).toBe(creation.now);
    }
  });
});
