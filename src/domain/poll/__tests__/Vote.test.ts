import { describe, it, expect } from 'vitest';
import { Vote } from '../Vote';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Vote Domain', () => {
  describe('create', () => {
    it('should create a vote with valid data', () => {
      const result = Vote.create('question-1', 'answer-1', 'user-1', 1.5);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.questionId).toBe('question-1');
        expect(result.value.answerId).toBe('answer-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.userWeight).toBe(1.5);
      }
    });

    it('should create a vote with default weight 1.0', () => {
      const result = Vote.create('question-1', 'answer-1', 'user-1', 1.0);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.userWeight).toBe(1.0);
      }
    });

    it('should fail with negative weight', () => {
      const result = Vote.create('question-1', 'answer-1', 'user-1', -1.0);

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.INVALID_WEIGHT);
      }
    });

    it('should allow zero weight', () => {
      const result = Vote.create('question-1', 'answer-1', 'user-1', 0);

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.userWeight).toBe(0);
      }
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute vote from props', () => {
      const vote = Vote.reconstitute({
        id: 'vote-1',
        questionId: 'question-1',
        answerId: 'answer-1',
        userId: 'user-1',
        userWeight: 2.5,
        createdAt: new Date(),
      });

      expect(vote.id).toBe('vote-1');
      expect(vote.questionId).toBe('question-1');
      expect(vote.answerId).toBe('answer-1');
      expect(vote.userId).toBe('user-1');
      expect(vote.userWeight).toBe(2.5);
    });
  });
});
