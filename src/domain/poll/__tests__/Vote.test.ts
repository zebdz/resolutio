/** Accepted selection clients preserve explicit identity, weight and cast time.
 * Rehydration copies mutable persistence data before retaining it in the domain. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { QuestionId, AnswerId, UserId, VoteId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { describe, it, expect } from 'vitest';
import { Vote } from '../Vote';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Vote Domain', () => {
  describe('create', () => {
    it('should create a vote with valid data', () => {
      const result = Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.5),
        testCreation(VoteId, 'vote-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.questionId).toBe('question-1');
        expect(result.value.answerId).toBe('answer-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.userWeight).toBe(1.5);
      }
    });

    it('should create a vote with default weight 1.0', () => {
      const result = Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(1.0),
        testCreation(VoteId, 'vote-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.userWeight).toBe(1.0);
      }
    });

    it('should fail with negative weight', () => {
      const result = Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        // @ts-expect-error Exercise malformed external weight at runtime.
        -1.0,
        testCreation(VoteId, 'vote-1')
      );

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.INVALID_WEIGHT);
      }
    });

    it('should allow zero weight', () => {
      const result = Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(0),
        testCreation(VoteId, 'vote-1')
      );

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.userWeight).toBe(0);
      }
    });
  });

  describe('reconstitute', () => {
    it('owns its saved timestamp and rejects invalid rehydration', () => {
      const props = {
        id: 'v1',
        questionId: 'q1',
        answerId: 'a1',
        userId: 'u1',
        userWeight: 1,
        createdAt: new Date('2026-10-26T10:00:00.123Z'),
      };
      const vote = Vote.reconstitute(props);
      props.createdAt.setFullYear(2000);
      props.userWeight = 99;
      expect(vote.createdAt.toISOString()).toBe('2026-10-26T10:00:00.123Z');
      expect(vote.userWeight).toBe(1);
      expect(() =>
        Vote.reconstitute({ ...props, createdAt: new Date('invalid') })
      ).toThrow();
    });
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
