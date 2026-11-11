/** Draft creation and refresh use caller-supplied identity/time without I/O.
 * Mutable Date values at persistence boundaries never expose internal timestamps. */
import { describe, expect, it } from 'vitest';
import { VoteDraft } from '../VoteDraft';
import {
  VoteDraftId,
  PollId,
  QuestionId,
  AnswerId,
  UserId,
} from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';

describe('VoteDraft identity and timestamps', () => {
  it('uses supplied identity/time and refreshes only at an explicit instant', () => {
    const creation = testCreation(VoteDraftId, 'draft-1');
    const result = VoteDraft.create(
      PollId.parse('poll-1'),
      QuestionId.parse('question-1'),
      AnswerId.parse('answer-1'),
      UserId.parse('user-1'),
      creation
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(creation.id);
      expect(result.value.createdAt.toISOString()).toBe(creation.now);
      expect(result.value.updatedAt.toISOString()).toBe(creation.now);
      const updated = Instant.parse('2026-01-01T00:00:01.000Z');
      result.value.touch(updated);
      expect(result.value.updatedAt.toISOString()).toBe(updated);
      result.value.updatedAt.setFullYear(1999);
      expect(result.value.updatedAt.toISOString()).toBe(updated);
    }
  });
});
