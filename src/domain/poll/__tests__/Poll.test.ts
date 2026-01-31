import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollDomainCodes } from '../PollDomainCodes';
import { PollState } from '../PollState';

// Helper: create a question with an answer (required for poll activation)
function createQuestionWithAnswer(pollId: string): Question {
  const questionResult = Question.create(
    'Test Question',
    pollId,
    1,
    0,
    'single-choice'
  );
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

      // Activate poll (must go through READY state first)
      poll.takeSnapshot();
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

      // Finish poll (must go through READY → ACTIVE first)
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.takeSnapshot();
      poll.activate();
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

      poll.takeSnapshot();
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

      poll.takeSnapshot();
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

      poll.takeSnapshot();
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

      poll.takeSnapshot();
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
    it('should be in DRAFT state initially (no snapshot)', () => {
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
        expect(poll.isDraft()).toBe(true);
        expect(poll.isReady()).toBe(false);
      }
    });

    it('should be in READY state after taking snapshot', () => {
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
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        expect(poll.isReady()).toBe(true);
      }
    });

    it('should allow modifying participants in READY state with no votes', () => {
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
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
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
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        expect(poll.canModifyParticipants(true)).toBe(false);
      }
    });

    it('should not allow modifying participants in DRAFT state', () => {
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

  describe('addAnswerToQuestion', () => {
    it('should add answer to existing question', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;

      // Add a question without answers
      const questionResult = Question.create(
        'Test Question',
        poll.id,
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      poll.addQuestion(question);

      const result = poll.addAnswerToQuestion('question-1', 'New Answer', 1);
      expect(result.success).toBe(true);

      // Verify answer was added
      const updatedQuestion = poll.questions.find((q) => q.id === 'question-1');
      expect(updatedQuestion?.answers.length).toBe(1);
      expect(updatedQuestion?.answers[0].text).toBe('New Answer');
    });

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

      // Add question with answer
      const questionResult = Question.create(
        'Test Question',
        poll.id,
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      const answerResult = Answer.create('Test Answer', 1, question.id);
      question.addAnswer(answerResult.value);
      poll.addQuestion(question);

      // Activate through state machine
      poll.takeSnapshot();
      poll.activate();

      const result = poll.addAnswerToQuestion('question-1', 'New Answer', 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_ADD_ANSWER_ACTIVE);
    });

    it('should fail if poll is finished', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;

      // Add question with answer
      const questionResult = Question.create(
        'Test Question',
        poll.id,
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      const answerResult = Answer.create('Test Answer', 1, question.id);
      question.addAnswer(answerResult.value);
      poll.addQuestion(question);

      // Finish through state machine
      poll.takeSnapshot();
      poll.activate();
      poll.finish();

      const result = poll.addAnswerToQuestion('question-1', 'New Answer', 2);
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        PollDomainCodes.POLL_CANNOT_ADD_ANSWER_FINISHED
      );
    });

    it('should fail if question not found', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;

      const result = poll.addAnswerToQuestion('non-existent', 'New Answer', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.QUESTION_NOT_FOUND);
    });

    it('should fail if question is archived', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;

      const questionResult = Question.create(
        'Test Question',
        poll.id,
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      poll.addQuestion(question);

      // Archive the question
      question.archive();

      const result = poll.addAnswerToQuestion('question-1', 'New Answer', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        PollDomainCodes.QUESTION_CANNOT_ADD_ANSWER_ARCHIVED
      );
    });

    it('should fail with invalid answer text', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;

      const questionResult = Question.create(
        'Test Question',
        poll.id,
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      poll.addQuestion(question);

      const result = poll.addAnswerToQuestion('question-1', '', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.ANSWER_TEXT_EMPTY);
    });
  });

  describe('Poll State Machine', () => {
    describe('initial state', () => {
      it('should have DRAFT state by default', () => {
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
        expect(poll.state).toBe(PollState.DRAFT);
      });
    });

    describe('takeSnapshot (DRAFT → READY)', () => {
      it('should transition from DRAFT to READY', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        const result = poll.takeSnapshot();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.READY);
      });

      it('should fail if poll has no questions', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.takeSnapshot();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
      });

      it('should fail if poll is not in DRAFT state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        const result = poll.takeSnapshot();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_DRAFT);
      });
    });

    describe('discardSnapshot (READY → DRAFT)', () => {
      it('should transition from READY to DRAFT when no votes', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        const result = poll.discardSnapshot(false);

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.DRAFT);
      });

      it('should fail if poll has votes', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        const result = poll.discardSnapshot(true);

        expect(result.success).toBe(false);
        expect(result.error).toBe(
          PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES
        );
      });

      it('should fail if poll is not in READY state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.discardSnapshot(false);

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_READY);
      });
    });

    describe('activate (READY → ACTIVE)', () => {
      it('should transition from READY to ACTIVE', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        const result = poll.activate();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.ACTIVE);
      });

      it('should fail if poll is not in READY state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.activate();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_READY);
      });
    });

    describe('deactivate (ACTIVE → READY)', () => {
      it('should transition from ACTIVE to READY', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        poll.activate();

        const result = poll.deactivate();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.READY);
      });

      it('should fail if poll is not in ACTIVE state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.deactivate();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
      });
    });

    describe('finish (ACTIVE → FINISHED)', () => {
      it('should transition from ACTIVE to FINISHED', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        poll.activate();

        const result = poll.finish();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.FINISHED);
      });

      it('should fail if poll is not in ACTIVE state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.finish();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
      });
    });

    describe('canModifyParticipants with state machine', () => {
      it('should allow modifying participants in READY state with no votes', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        expect(poll.canModifyParticipants(false)).toBe(true);
      });

      it('should not allow modifying participants in READY state with votes', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();

        expect(poll.canModifyParticipants(true)).toBe(false);
      });

      it('should not allow modifying participants in DRAFT state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        expect(poll.canModifyParticipants(false)).toBe(false);
      });

      it('should not allow modifying participants in ACTIVE state with votes', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        poll.activate();

        expect(poll.canModifyParticipants(true)).toBe(false);
      });

      it('should not allow modifying participants in FINISHED state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.takeSnapshot();
        poll.activate();
        poll.finish();

        expect(poll.canModifyParticipants(false)).toBe(false);
      });
    });

    describe('helper methods', () => {
      it('isActive should return true only in ACTIVE state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isActive()).toBe(false);

        poll.takeSnapshot();
        expect(poll.isActive()).toBe(false);

        poll.activate();
        expect(poll.isActive()).toBe(true);

        poll.finish();
        expect(poll.isActive()).toBe(false);
      });

      it('isFinished should return true only in FINISHED state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isFinished()).toBe(false);

        poll.takeSnapshot();
        expect(poll.isFinished()).toBe(false);

        poll.activate();
        expect(poll.isFinished()).toBe(false);

        poll.finish();
        expect(poll.isFinished()).toBe(true);
      });

      it('isReady should return true only in READY state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isReady()).toBe(false);

        poll.takeSnapshot();
        expect(poll.isReady()).toBe(true);

        poll.activate();
        expect(poll.isReady()).toBe(false);
      });

      it('isDraft should return true only in DRAFT state', () => {
        const pollResult = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isDraft()).toBe(true);

        poll.takeSnapshot();
        expect(poll.isDraft()).toBe(false);
      });
    });
  });
});
