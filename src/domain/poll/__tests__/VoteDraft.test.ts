import { describe, it, expect } from 'vitest';
import { VoteDraft } from '../VoteDraft';

describe('VoteDraft Domain', () => {
  describe('create', () => {
    it('should create a draft with valid data', () => {
      const result = VoteDraft.create(
        'poll-1',
        'question-1',
        'answer-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.pollId).toBe('poll-1');
        expect(result.value.questionId).toBe('question-1');
        expect(result.value.answerId).toBe('answer-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.createdAt).toBeInstanceOf(Date);
        expect(result.value.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should set createdAt and updatedAt to same time initially', () => {
      const result = VoteDraft.create(
        'poll-1',
        'question-1',
        'answer-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const timeDiff = Math.abs(
          result.value.updatedAt.getTime() - result.value.createdAt.getTime()
        );
        expect(timeDiff).toBeLessThan(100); // Within 100ms
      }
    });
  });

  describe('touch', () => {
    it('should update updatedAt when touched', async () => {
      const result = VoteDraft.create(
        'poll-1',
        'question-1',
        'answer-1',
        'user-1'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        const draft = result.value;
        const originalUpdatedAt = draft.updatedAt;

        // Wait a bit to ensure time difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        draft.touch();

        expect(draft.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime()
        );
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute draft from props', () => {
      const createdAt = new Date('2026-01-15T10:00:00Z');
      const updatedAt = new Date('2026-01-15T10:05:00Z');

      const draft = VoteDraft.reconstitute({
        id: 'draft-1',
        pollId: 'poll-1',
        questionId: 'question-1',
        answerId: 'answer-1',
        userId: 'user-1',
        createdAt,
        updatedAt,
      });

      expect(draft.id).toBe('draft-1');
      expect(draft.pollId).toBe('poll-1');
      expect(draft.questionId).toBe('question-1');
      expect(draft.answerId).toBe('answer-1');
      expect(draft.userId).toBe('user-1');
      expect(draft.createdAt).toBe(createdAt);
      expect(draft.updatedAt).toBe(updatedAt);
    });
  });
});
