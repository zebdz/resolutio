import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollDomainCodes } from '../PollDomainCodes';

// Helper: create a question with an answer (required for poll activation)
function createQuestionWithAnswer(pollId: string): Question {
  const questionResult = Question.create('Test Question', pollId, 1, 0, 'single-choice');
  const question = questionResult.value;
  const answerResult = Answer.create('Test Answer', 1, question.id);
  question.addAnswer(answerResult.value);

  return question;
}

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

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

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

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

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

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

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

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

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

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

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

  describe('Participant Snapshot Management', () => {
    it('should not have snapshot taken initially', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        expect(poll.participantsSnapshotTaken).toBe(false);
      }
    });

    it('should mark snapshot as taken', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        poll.takeParticipantsSnapshot();
        expect(poll.participantsSnapshotTaken).toBe(true);
      }
    });

    it('should allow modifying participants when snapshot taken but no votes', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        poll.takeParticipantsSnapshot();
        expect(poll.canModifyParticipants(false)).toBe(true);
      }
    });

    it('should not allow modifying participants when votes exist', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        poll.takeParticipantsSnapshot();
        expect(poll.canModifyParticipants(true)).toBe(false);
      }
    });

    it('should not allow modifying participants when snapshot not taken', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        expect(poll.canModifyParticipants(false)).toBe(false);
      }
    });
  });

  describe('Weight Criteria', () => {
    it('should have null weight criteria initially', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        expect(poll.weightCriteria).toBeNull();
      }
    });

    it('should set weight criteria', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        poll.setWeightCriteria('property_area');
        expect(poll.weightCriteria).toBe('property_area');
      }
    });

    it('should allow clearing weight criteria', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      if (pollResult.success) {
        const poll = pollResult.value;
        poll.setWeightCriteria('property_area');
        expect(poll.weightCriteria).toBe('property_area');
        poll.setWeightCriteria(null);
        expect(poll.weightCriteria).toBeNull();
      }
    });
  });
});
