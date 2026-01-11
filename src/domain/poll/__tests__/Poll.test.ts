import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { PollDomainCodes } from '../PollDomainCodes';

describe('Poll Domain', () => {
  describe('canEdit', () => {
    it('should allow editing when poll is not active, not finished, and has no votes', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(canEditResult.value).toBe(true);
    });

    it('should not allow editing when poll is active', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      // Add a question so we can activate the poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      poll.addQuestion(questionResult.value);

      // Activate poll
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(canEditResult.value).toBe(false);
    });

    it('should not allow editing when poll is finished', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      // Finish poll
      poll.finish();

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(canEditResult.value).toBe(false);
    });

    it('should not allow editing when poll has votes', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      const canEditResult = poll.canEdit(true);
      expect(canEditResult.success).toBe(true);
      expect(canEditResult.value).toBe(false);
    });

    it('should not allow editing when poll is both active and has votes', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      // Add a question so we can activate the poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      poll.addQuestion(questionResult.value);

      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const canEditResult = poll.canEdit(true);
      expect(canEditResult.success).toBe(true);
      expect(canEditResult.value).toBe(false);
    });
  });

  describe('updateTitle', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question so we can activate the poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      poll.addQuestion(questionResult.value);

      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateTitle('New Title');
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    });
  });

  describe('updateDescription', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question so we can activate the poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      poll.addQuestion(questionResult.value);

      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateDescription('New Description');
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    });
  });

  describe('updateDates', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question so we can activate the poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      poll.addQuestion(questionResult.value);

      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateDates(
        new Date('2026-01-20'),
        new Date('2026-02-20')
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED);
    });
  });
});
