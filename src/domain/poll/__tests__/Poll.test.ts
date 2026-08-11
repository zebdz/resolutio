import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollDomainCodes } from '../PollDomainCodes';
import { POLL_ATTACHMENT_COUNT_LIMIT } from '../PollAttachment';
import { PollState } from '../PollState';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

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
        'org-1',
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
        'org-1',
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
      poll.submitToAdmin();
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      // Finish poll (must go through READY → ACTIVE first)
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
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
        'org-1',
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
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
        'org-1',
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
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);

      if (pollResult.success) {
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.isReady()).toBe(true);
      }
    });

    it('should allow modifying participants in READY state with no votes', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);

      if (pollResult.success) {
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.canModifyParticipants(false)).toBe(true);
      }
    });

    it('should not allow modifying participants when votes exist', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'org-1',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);

      if (pollResult.success) {
        const poll = pollResult.value;
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.canModifyParticipants(true)).toBe(false);
      }
    });

    it('should not allow modifying participants in DRAFT state', () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'org-1',
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
        'org-1',
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
        'org-1',
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
        'org-1',
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
        'org-1',
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
        'org-1',
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
      poll.submitToAdmin();
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
        'org-1',
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
      poll.submitToAdmin();
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
        'org-1',
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
        'org-1',
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
        'org-1',
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

    function draftWithQuestion() {
      const poll = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      ).value;
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      return poll;
    }

    describe('submitToAdmin (DRAFT → SUBMITTED)', () => {
      it('should transition from DRAFT to SUBMITTED', () => {
        const poll = draftWithQuestion();

        const result = poll.submitToAdmin();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.SUBMITTED);
      });

      // Caught here rather than at snapshot so the author sees it while the
      // poll is still theirs to fix.
      it('should fail if poll has no questions', () => {
        const poll = Poll.create(
          'Test Poll',
          'Test Description',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        ).value;

        const result = poll.submitToAdmin();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
      });

      it('should fail if the poll was already submitted', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.submitToAdmin();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_DRAFT);
      });
    });

    describe('returnToDraft (SUBMITTED → DRAFT)', () => {
      it('should transition from SUBMITTED back to DRAFT', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.returnToDraft();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.DRAFT);
      });

      // The author's recall window closes once an admin has frozen
      // participants; from READY the way back is discardSnapshot.
      it('should fail once the poll is READY', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.returnToDraft();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
      });

      it('should fail on a poll that was never submitted', () => {
        const poll = draftWithQuestion();

        const result = poll.returnToDraft();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
      });
    });

    describe('takeSnapshot (SUBMITTED → READY)', () => {
      it('should transition from SUBMITTED to READY', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.takeSnapshot();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.READY);
      });

      // The regression this state exists to prevent: an admin freezing a poll
      // whose author has not handed it over.
      it('should refuse a draft the author has not submitted', () => {
        const poll = draftWithQuestion();

        const result = poll.takeSnapshot();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
        expect(poll.state).toBe(PollState.DRAFT);
      });

      it('should fail if poll is already READY', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.takeSnapshot();

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
      });
    });

    describe('content lock while submitted', () => {
      it('refuses edits until the poll is recalled', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.updateTitle('Changed behind the admin');

        expect(result.success).toBe(false);
        expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED);
        expect(poll.canEdit(false).value).toBe(false);
      });

      it('allows edits again after a recall', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();
        poll.returnToDraft();

        expect(poll.updateTitle('Changed after recall').success).toBe(true);
        expect(poll.canEdit(false).value).toBe(true);
      });
    });

    describe('discardSnapshot (READY → SUBMITTED)', () => {
      // Undoing the freeze is the admin's to undo; the handover is not. A poll
      // dropped to DRAFT here would revoke the author's submission behind
      // their back and leave them waiting on a poll they had already sent.
      it('should return to SUBMITTED when no votes, not to DRAFT', () => {
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
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.discardSnapshot(false);

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.SUBMITTED);
      });

      // And the poll is immediately re-freezable, without the author having to
      // submit it a second time.
      it('leaves the poll ready to be frozen again', () => {
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
        poll.submitToAdmin();
        poll.takeSnapshot();
        poll.discardSnapshot(false);

        expect(poll.takeSnapshot().success).toBe(true);
        expect(poll.state).toBe(PollState.READY);
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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
        poll.submitToAdmin();
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

        poll.submitToAdmin();
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

        poll.submitToAdmin();
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

        poll.submitToAdmin();
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

        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.isDraft()).toBe(false);
      });
    });
  });

  describe('Poll profanity checks', () => {
    describe('create', () => {
      it('should reject profane title', () => {
        const result = Poll.create(
          'badword title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should reject profane description', () => {
        const result = Poll.create(
          'Clean title',
          'badword description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean text with profanity checker', () => {
        const result = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Poll.create(
          'badword title',
          'badword description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateTitle', () => {
      it('should reject profane title', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.updateTitle('badword title', mockProfanityChecker);

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean title with profanity checker', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.updateTitle(
          'New clean title',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateDescription', () => {
      it('should reject profane description', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.updateDescription(
          'badword description',
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean description with profanity checker', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
          'board-1',
          'user-1',
          new Date('2026-01-15'),
          new Date('2026-02-15')
        );
        const poll = pollResult.value;

        const result = poll.updateDescription(
          'New clean description',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('addAnswerToQuestion', () => {
      it('should reject profane answer text via Answer.create', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
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

        const result = poll.addAnswerToQuestion(
          'question-1',
          'badword answer',
          1,
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean answer text with profanity checker', () => {
        const pollResult = Poll.create(
          'Clean title',
          'Clean description',
          'org-1',
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

        const result = poll.addAnswerToQuestion(
          'question-1',
          'Clean answer',
          1,
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Question profanity checks', () => {
    describe('create', () => {
      it('should reject profane question text', () => {
        const result = Question.create(
          'badword question',
          'poll-1',
          1,
          0,
          'single-choice',
          undefined,
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should reject profane question details', () => {
        const result = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice',
          'badword details',
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean text with profanity checker', () => {
        const result = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice',
          'Clean details',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Question.create(
          'badword question',
          'poll-1',
          1,
          0,
          'single-choice',
          'badword details'
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateText', () => {
      it('should reject profane text', () => {
        const questionResult = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice'
        );
        const question = questionResult.value;

        const result = question.updateText(
          'badword text',
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean text with profanity checker', () => {
        const questionResult = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice'
        );
        const question = questionResult.value;

        const result = question.updateText(
          'New clean text',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateDetails', () => {
      it('should reject profane details', () => {
        const questionResult = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice'
        );
        const question = questionResult.value;

        const result = question.updateDetails(
          'badword details',
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow null details with profanity checker', () => {
        const questionResult = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice',
          'Some details'
        );
        const question = questionResult.value;

        const result = question.updateDetails(null, mockProfanityChecker);

        expect(result.success).toBe(true);
      });

      it('should allow clean details with profanity checker', () => {
        const questionResult = Question.create(
          'Clean question',
          'poll-1',
          1,
          0,
          'single-choice'
        );
        const question = questionResult.value;

        const result = question.updateDetails(
          'Clean details',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Answer profanity checks', () => {
    describe('create', () => {
      it('should reject profane answer text', () => {
        const result = Answer.create(
          'badword answer',
          0,
          'question-1',
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean text with profanity checker', () => {
        const result = Answer.create(
          'Clean answer',
          0,
          'question-1',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Answer.create('badword answer', 0, 'question-1');

        expect(result.success).toBe(true);
      });
    });

    describe('updateText', () => {
      it('should reject profane text', () => {
        const answerResult = Answer.create('Clean answer', 0, 'question-1');
        const answer = answerResult.value;

        const result = answer.updateText('badword text', mockProfanityChecker);

        expect(result.success).toBe(false);
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      });

      it('should allow clean text with profanity checker', () => {
        const answerResult = Answer.create('Clean answer', 0, 'question-1');
        const answer = answerResult.value;

        const result = answer.updateText(
          'New clean text',
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });
  });
});

describe('Poll type', () => {
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-02-01');

  function createPoll(boardId: string | null, pollType?: string) {
    return Poll.create(
      'Title',
      'Description',
      'org-1',
      boardId,
      'user-1',
      startDate,
      endDate,
      undefined,
      pollType
    );
  }

  it('should default to ORGANIZATION', () => {
    const result = createPoll(null);

    expect(result.success).toBe(true);
    expect(result.value.pollType).toBe('ORGANIZATION');
    expect(result.value.isOpen()).toBe(false);
  });

  it('should create an OPEN poll with equal weight defaults', () => {
    const result = createPoll(null, 'OPEN');

    expect(result.success).toBe(true);
    expect(result.value.isOpen()).toBe(true);
    expect(result.value.distributionType).toBe('EQUAL');
    expect(result.value.propertyAggregation).toBe('RAW_SUM');
    expect(result.value.propertyIds).toEqual([]);
  });

  it('should reject an OPEN poll scoped to a board', () => {
    const result = createPoll('board-1', 'OPEN');

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED);
  });

  it('should reject an unknown poll type', () => {
    const result = createPoll(null, 'WHATEVER');

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_TYPE_INVALID);
  });

  describe('applyWeightConfig', () => {
    it('should accept the equal defaults on an OPEN poll', () => {
      const poll = createPoll(null, 'OPEN').value;

      const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', []);

      expect(result.success).toBe(true);
    });

    it('should reject ownership weighting on an OPEN poll', () => {
      const poll = createPoll(null, 'OPEN').value;

      const result = poll.applyWeightConfig(
        'OWNERSHIP_UNIT_COUNT',
        'RAW_SUM',
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
      expect(poll.distributionType).toBe('EQUAL');
    });

    it('should reject a property scope on an OPEN poll', () => {
      const poll = createPoll(null, 'OPEN').value;

      const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', ['prop-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL);
      expect(poll.propertyIds).toEqual([]);
    });

    it('should still work normally on an ORGANIZATION poll', () => {
      const poll = createPoll(null).value;

      const result = poll.applyWeightConfig(
        'OWNERSHIP_UNIT_COUNT',
        'NORMALIZE_PER_PROPERTY',
        ['prop-1']
      );

      expect(result.success).toBe(true);
      expect(poll.distributionType).toBe('OWNERSHIP_UNIT_COUNT');
      expect(poll.propertyAggregation).toBe('NORMALIZE_PER_PROPERTY');
      expect(poll.propertyIds).toEqual(['prop-1']);
    });
  });

  describe('anonymous flag', () => {
    function create(pollType?: string, anonymous?: boolean) {
      return Poll.create(
        'Title',
        'Description',
        'org-1',
        null,
        'user-1',
        new Date('2026-01-01'),
        new Date('2026-02-01'),
        undefined,
        pollType,
        anonymous
      );
    }

    it('should default to named', () => {
      const result = create();

      expect(result.success).toBe(true);
      expect(result.value.isAnonymous()).toBe(false);
    });

    it('should create an anonymous poll when asked', () => {
      const result = create('ORGANIZATION', true);

      expect(result.success).toBe(true);
      expect(result.value.isAnonymous()).toBe(true);
    });

    it('should allow an anonymous OPEN poll', () => {
      const result = create('OPEN', true);

      expect(result.success).toBe(true);
      expect(result.value.isAnonymous()).toBe(true);
    });

    it('should allow a named OPEN poll', () => {
      const result = create('OPEN', false);

      expect(result.success).toBe(true);
      expect(result.value.isAnonymous()).toBe(false);
    });

    it('should round-trip through reconstitute', () => {
      const created = create('ORGANIZATION', true).value;

      const restored = Poll.reconstitute(created.toJSON() as any);

      expect(restored.isAnonymous()).toBe(true);
    });

    it('should expose no mutator for the flag', () => {
      const poll = create().value;

      expect((poll as any).setAnonymous).toBeUndefined();
    });
  });

  describe('description attachments', () => {
    function draftPoll(): Poll {
      const r = Poll.create(
        'Fence dispute',
        'The fence was moved.',
        'org-1',
        null,
        'user-1',
        new Date('2030-01-01'),
        new Date('2030-02-01')
      );

      if (!r.success) {
        throw new Error('fixture poll failed to build: ' + r.error);
      }

      return r.value;
    }

    it('should start with no attachments', () => {
      expect(draftPoll().attachmentIds).toEqual([]);
    });

    it('should add an attachment id', () => {
      const poll = draftPoll();
      const result = poll.addAttachment('att1');

      expect(result.success).toBe(true);
      expect(poll.attachmentIds).toEqual(['att1']);
    });

    it('should reject adding past the count limit', () => {
      const poll = draftPoll();

      for (let i = 0; i < POLL_ATTACHMENT_COUNT_LIMIT; i++) {
        expect(poll.addAttachment(`att${i}`).success).toBe(true);
      }

      const result = poll.addAttachment('one-too-many');

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    });

    it('should remove an attachment id', () => {
      const poll = draftPoll();
      poll.addAttachment('att1');

      const result = poll.removeAttachment('att1');

      expect(result.success).toBe(true);
      expect(poll.attachmentIds).toEqual([]);
    });

    it('should fail to remove an attachment that is not attached', () => {
      const poll = draftPoll();
      const result = poll.removeAttachment('nope');

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
    });

    // attachmentIds lives outside `props`, so the spread in toJSON would
    // silently drop it without an explicit key. Serialized poll payloads feed
    // the description renderer's allowlist; an empty list there makes every
    // inline image render as a blocked placeholder.
    it('should include attachmentIds in toJSON', () => {
      const poll = draftPoll();
      poll.addAttachment('att1');
      poll.addAttachment('att2');

      expect(poll.toJSON().attachmentIds).toEqual(['att1', 'att2']);
    });

    it('should serialize an empty attachment list rather than undefined', () => {
      expect(draftPoll().toJSON().attachmentIds).toEqual([]);
    });

    it('should not leak internal state through the getter', () => {
      const poll = draftPoll();
      poll.addAttachment('att1');

      poll.attachmentIds.push('injected');

      expect(poll.attachmentIds).toEqual(['att1']);
    });

    it('should fail to add an attachment once the poll is active', () => {
      const poll = draftPoll();
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = poll.addAttachment('att1');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
      );
    });

    it('should fail to remove an attachment once the poll is active', () => {
      const poll = draftPoll();
      poll.addAttachment('att1');
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = poll.removeAttachment('att1');

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
      );
    });
  });

  describe('updateDescription attachment refs', () => {
    function draftPollWithAttachment(): Poll {
      const r = Poll.create(
        'Fence dispute',
        'Initial text.',
        'org-1',
        null,
        'user-1',
        new Date('2030-01-01'),
        new Date('2030-02-01')
      );

      if (!r.success) {
        throw new Error('fixture poll failed to build: ' + r.error);
      }

      r.value.addAttachment('own1');

      return r.value;
    }

    it('should accept a description referencing its own attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        'See ![photo](/api/poll-attachments/own1)'
      );

      expect(result.success).toBe(true);
    });

    it('should reject a description referencing a foreign attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        'See ![photo](/api/poll-attachments/foreign9)'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
      );
    });

    it('should accept a PDF link ref to its own attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        'See [survey.pdf](/api/poll-attachments/own1)'
      );

      expect(result.success).toBe(true);
    });

    it('should ignore a report-attachment URL, which is not a poll ref', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        'See ![x](/api/report-attachments/other1)'
      );

      expect(result.success).toBe(true);
    });

    // A brand-new poll owns no attachments, so any ref in its initial
    // description necessarily points at another poll's file.
    it('should reject creating a poll whose description already has a ref', () => {
      const result = Poll.create(
        'Fence dispute',
        'See ![photo](/api/poll-attachments/someone-elses-file)',
        'org-1',
        null,
        'user-1',
        new Date('2030-01-01'),
        new Date('2030-02-01')
      );

      expect(result.success).toBe(false);
      expect(result.success === false && result.error).toBe(
        PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
      );
    });
  });
});
