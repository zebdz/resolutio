/** Poll lifecycle and editing invariants. Finish fixtures use stored identities
 * so event validation is exercised without bypassing aggregate construction. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import {
  QuestionText,
  AnswerText,
  QuestionDetails,
} from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { BoardId, UserId, PropertyId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { OrganizationId, PollAttachmentId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollId, QuestionId, AnswerId } from '@/domain/shared/EntityIds';
import { describe, it, expect } from 'vitest';
import { Poll } from '../Poll';
import { Question } from '../Question';
import { Answer } from '../Answer';
import { PollDomainCodes } from '../PollDomainCodes';
import { POLL_ATTACHMENT_COUNT_LIMIT } from '../PollAttachment';
import { PollState } from '../PollState';
import { PollType } from '../PollType';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';

// Reconstitute the stored identity before lifecycle events can be emitted.
function persistedPoll(poll: Poll): Poll {
  return Poll.reconstitute({
    ...poll.toJSON(),
    id: 'poll-1',
    questions: poll.questions,
  });
}

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
  findProfaneWords: (text: string) =>
    text.includes('badword') ? ['badword'] : [],
};

// Helper: create a question with an answer (required for poll activation)
function createQuestionWithAnswer(pollId: string): Question {
  const questionResult = Question.create(
    QuestionText.parse('Test Question'),
    PollId.parse(pollId),
    testCreation(QuestionId, 'question-1'),
    PageNumber.parse(1),
    SortOrder.parse(0),
    'single-choice'
  );
  const question = expectSuccess(questionResult);
  const answerResult = Answer.create(
    AnswerText.parse('Test Answer'),
    SortOrder.parse(1),
    question.id,
    testCreation(AnswerId, 'answer-1')
  );
  question.addAnswer(expectSuccess(answerResult));

  return question;
}

describe('Poll Domain', () => {
  describe('canEdit', () => {
    it('should allow editing when poll is not active, not finished, and has no votes', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);
      const poll = expectSuccess(pollResult);

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(expectSuccess(canEditResult)).toBe(true);
    });

    it('should not allow editing when poll is active', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);
      const poll = expectSuccess(pollResult);

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      // Activate poll (must go through READY state first)
      poll.submitToAdmin();
      poll.takeSnapshot();
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(expectSuccess(canEditResult)).toBe(false);
    });

    it('should not allow editing when poll is finished', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);
      const poll = persistedPoll(expectSuccess(pollResult));

      // Finish poll (must go through READY → ACTIVE first)
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();
      expect(
        poll.finish(PollInstant.parse(new Date().toISOString())).success
      ).toBe(true);

      const canEditResult = poll.canEdit(false);
      expect(canEditResult.success).toBe(true);
      expect(expectSuccess(canEditResult)).toBe(false);
    });

    it('should not allow editing when poll has votes', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);
      const poll = expectSuccess(pollResult);

      const canEditResult = poll.canEdit(true);
      expect(canEditResult.success).toBe(true);
      expect(expectSuccess(canEditResult)).toBe(false);
    });

    it('should not allow editing when poll is both active and has votes', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);
      const poll = expectSuccess(pollResult);

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
      poll.takeSnapshot();
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const canEditResult = poll.canEdit(true);
      expect(canEditResult.success).toBe(true);
      expect(expectSuccess(canEditResult)).toBe(false);
    });
  });

  describe('updateTitle', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      const poll = expectSuccess(pollResult);

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
      poll.takeSnapshot();
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateTitle(PollTitle.parse('New Title'));
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED
      );
    });
  });

  describe('updateDescription', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      const poll = expectSuccess(pollResult);

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
      poll.takeSnapshot();
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateDescription(
        PollDescription.parse('New Description')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED
      );
    });
  });

  describe('updateDates', () => {
    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      const poll = expectSuccess(pollResult);

      // Add a question with answer so we can activate the poll
      poll.addQuestion(createQuestionWithAnswer(poll.id));

      poll.submitToAdmin();
      poll.takeSnapshot();
      const activateResult = poll.activate();
      expect(activateResult.success).toBe(true);

      const result = poll.updateDates(
        expectSuccess(
          PollPeriod.create(new Date('2026-01-20'), new Date('2026-02-20'))
        )
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_UPDATE_FINISHED
      );
    });
  });

  describe('Participant Snapshot Management', () => {
    it('should be in DRAFT state initially (no snapshot)', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(pollResult.success).toBe(true);

      if (pollResult.success) {
        const poll = pollResult.value;
        expect(poll.weightCriteria).toBeNull();
      }
    });

    it('should set weight criteria', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
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
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = expectSuccess(pollResult);

      // Add a question without answers
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        poll.id,
        testCreation(QuestionId, 'question-2'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      let question = expectSuccess(questionResult);
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-1',
      });
      poll.addQuestion(question);

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('question-1'),
        AnswerText.parse('New Answer'),
        SortOrder.parse(1),
        testCreation(AnswerId, 'answer-2')
      );
      expect(result.success).toBe(true);

      // Verify answer was added
      const updatedQuestion = poll.questions.find((q) => q.id === 'question-1');
      expect(updatedQuestion?.answers.length).toBe(1);
      expect(updatedQuestion?.answers[0].text).toBe('New Answer');
    });

    it('should fail if poll is active', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = expectSuccess(pollResult);

      // Add question with answer
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        poll.id,
        testCreation(QuestionId, 'question-3'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      let question = expectSuccess(questionResult);
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-1',
      });
      const answerResult = Answer.create(
        AnswerText.parse('Test Answer'),
        SortOrder.parse(1),
        question.id,
        testCreation(AnswerId, 'answer-3')
      );
      question.addAnswer(expectSuccess(answerResult));
      poll.addQuestion(question);

      // Activate through state machine
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('question-1'),
        AnswerText.parse('New Answer'),
        SortOrder.parse(2),
        testCreation(AnswerId, 'answer-4')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_ADD_ANSWER_ACTIVE
      );
    });

    it('should fail if poll is finished', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = persistedPoll(expectSuccess(pollResult));

      // Add question with answer
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        poll.id,
        testCreation(QuestionId, 'question-4'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      let question = expectSuccess(questionResult);
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-1',
      });
      const answerResult = Answer.create(
        AnswerText.parse('Test Answer'),
        SortOrder.parse(1),
        question.id,
        testCreation(AnswerId, 'answer-5')
      );
      question.addAnswer(expectSuccess(answerResult));
      poll.addQuestion(question);

      // Finish through state machine
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();
      expect(
        poll.finish(PollInstant.parse(new Date().toISOString())).success
      ).toBe(true);

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('question-1'),
        AnswerText.parse('New Answer'),
        SortOrder.parse(2),
        testCreation(AnswerId, 'answer-6')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_ADD_ANSWER_FINISHED
      );
    });

    it('should fail if question not found', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = expectSuccess(pollResult);

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('non-existent'),
        AnswerText.parse('New Answer'),
        SortOrder.parse(1),
        testCreation(AnswerId, 'answer-7')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.QUESTION_NOT_FOUND);
    });

    it('should fail if question is archived', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = expectSuccess(pollResult);

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        poll.id,
        testCreation(QuestionId, 'question-5'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      let question = expectSuccess(questionResult);
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-1',
      });
      poll.addQuestion(question);

      // Archive the question
      question.archive(Instant.parse('2026-01-02T00:00:00.000Z'));

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('question-1'),
        AnswerText.parse('New Answer'),
        SortOrder.parse(1),
        testCreation(AnswerId, 'answer-8')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.QUESTION_CANNOT_ADD_ANSWER_ARCHIVED
      );
    });

    it('should fail with invalid answer text', () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      const poll = expectSuccess(pollResult);

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        poll.id,
        testCreation(QuestionId, 'question-6'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      let question = expectSuccess(questionResult);
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-1',
      });
      poll.addQuestion(question);

      const result = poll.addAnswerToQuestion(
        QuestionId.parse('question-1'),

        // @ts-expect-error Exercise runtime rejection of malformed caller content.
        '',
        SortOrder.parse(1),
        testCreation(AnswerId, 'answer-9')
      );
      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.ANSWER_TEXT_EMPTY);
    });
  });

  describe('Poll State Machine', () => {
    describe('initial state', () => {
      it('should have DRAFT state by default', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );

        expect(pollResult.success).toBe(true);
        const poll = expectSuccess(pollResult);
        expect(poll.state).toBe(PollState.DRAFT);
      });
    });

    function draftWithQuestion() {
      const poll = expectSuccess(
        Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        )
      );
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
        const poll = expectSuccess(
          Poll.create(
            PollTitle.parse('Test Poll'),
            PollDescription.parse('Test Description'),
            OrganizationId.parse('org-1'),
            BoardId.parse('board-1'),
            UserId.parse('user-1'),
            expectSuccess(
              PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
            ),
            pollFixtureCreation(PollId)
          )
        );

        const result = poll.submitToAdmin();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
      });

      it('should fail if the poll was already submitted', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.submitToAdmin();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_DRAFT);
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
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_MUST_BE_SUBMITTED
        );
      });

      it('should fail on a poll that was never submitted', () => {
        const poll = draftWithQuestion();

        const result = poll.returnToDraft();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_MUST_BE_SUBMITTED
        );
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
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_MUST_BE_SUBMITTED
        );
        expect(poll.state).toBe(PollState.DRAFT);
      });

      it('should fail if poll is already READY', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.takeSnapshot();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_MUST_BE_SUBMITTED
        );
      });
    });

    describe('content lock while submitted', () => {
      it('refuses edits until the poll is recalled', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();

        const result = poll.updateTitle(
          PollTitle.parse('Changed behind the admin')
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_CANNOT_UPDATE_SUBMITTED
        );
        expect(expectSuccess(poll.canEdit(false))).toBe(false);
      });

      it('allows edits again after a recall', () => {
        const poll = draftWithQuestion();
        poll.submitToAdmin();
        poll.returnToDraft();

        expect(
          poll.updateTitle(PollTitle.parse('Changed after recall')).success
        ).toBe(true);
        expect(expectSuccess(poll.canEdit(false))).toBe(true);
      });
    });

    describe('discardSnapshot (READY → SUBMITTED)', () => {
      // Undoing the freeze is the admin's to undo; the handover is not. A poll
      // dropped to DRAFT here would revoke the author's submission behind
      // their back and leave them waiting on a poll they had already sent.
      it('should return to SUBMITTED when no votes, not to DRAFT', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
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
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        poll.discardSnapshot(false);

        expect(poll.takeSnapshot().success).toBe(true);
        expect(poll.state).toBe(PollState.READY);
      });

      it('should fail if poll has votes', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.discardSnapshot(true);

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES
        );
      });

      it('should fail if poll is not in READY state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);

        const result = poll.discardSnapshot(false);

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_READY);
      });
    });

    describe('activate (READY → ACTIVE)', () => {
      it('should transition from READY to ACTIVE', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();

        const result = poll.activate();

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.ACTIVE);
      });

      it('should fail if poll is not in READY state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);

        const result = poll.activate();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_READY);
      });
    });

    describe('deactivate (ACTIVE → READY)', () => {
      it('should transition from ACTIVE to READY', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
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
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);

        const result = poll.deactivate();

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
      });
    });

    describe('finish (ACTIVE → FINISHED)', () => {
      it('should transition from ACTIVE to FINISHED', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = persistedPoll(expectSuccess(pollResult));
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        poll.activate();

        const result = poll.finish(PollInstant.parse(new Date().toISOString()));

        expect(result.success).toBe(true);
        expect(poll.state).toBe(PollState.FINISHED);
      });

      it('should fail if poll is not in ACTIVE state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = persistedPoll(expectSuccess(pollResult));

        const result = poll.finish(PollInstant.parse(new Date().toISOString()));

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
      });
    });

    describe('canModifyParticipants with state machine', () => {
      it('should allow modifying participants in READY state with no votes', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();

        expect(poll.canModifyParticipants(false)).toBe(true);
      });

      it('should not allow modifying participants in READY state with votes', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();

        expect(poll.canModifyParticipants(true)).toBe(false);
      });

      it('should not allow modifying participants in DRAFT state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);

        expect(poll.canModifyParticipants(false)).toBe(false);
      });

      it('should not allow modifying participants in ACTIVE state with votes', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        poll.activate();

        expect(poll.canModifyParticipants(true)).toBe(false);
      });

      it('should not allow modifying participants in FINISHED state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = persistedPoll(expectSuccess(pollResult));
        poll.addQuestion(createQuestionWithAnswer(poll.id));
        poll.submitToAdmin();
        poll.takeSnapshot();
        poll.activate();
        expect(
          poll.finish(PollInstant.parse(new Date().toISOString())).success
        ).toBe(true);

        expect(poll.canModifyParticipants(false)).toBe(false);
      });
    });

    describe('helper methods', () => {
      it('isActive should return true only in ACTIVE state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = persistedPoll(expectSuccess(pollResult));
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isActive()).toBe(false);

        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.isActive()).toBe(false);

        poll.activate();
        expect(poll.isActive()).toBe(true);

        expect(
          poll.finish(PollInstant.parse(new Date().toISOString())).success
        ).toBe(true);
        expect(poll.isActive()).toBe(false);
      });

      it('isFinished should return true only in FINISHED state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = persistedPoll(expectSuccess(pollResult));
        poll.addQuestion(createQuestionWithAnswer(poll.id));

        expect(poll.isFinished()).toBe(false);

        poll.submitToAdmin();
        poll.takeSnapshot();
        expect(poll.isFinished()).toBe(false);

        poll.activate();
        expect(poll.isFinished()).toBe(false);

        expect(
          poll.finish(PollInstant.parse(new Date().toISOString())).success
        ).toBe(true);
        expect(poll.isFinished()).toBe(true);
      });

      it('isReady should return true only in READY state', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
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
          PollTitle.parse('Test Poll'),
          PollDescription.parse('Test Description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          pollFixtureCreation(PollId)
        );
        const poll = expectSuccess(pollResult);
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
          PollTitle.parse('badword title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should reject profane description', () => {
        const result = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('badword description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean text with profanity checker', () => {
        const result = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Poll.create(
          PollTitle.parse('badword title'),
          PollDescription.parse('badword description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateTitle', () => {
      it('should reject profane title', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const result = poll.updateTitle(
          PollTitle.parse('badword title'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean title with profanity checker', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const result = poll.updateTitle(
          PollTitle.parse('New clean title'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateDescription', () => {
      it('should reject profane description', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const result = poll.updateDescription(
          PollDescription.parse('badword description'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean description with profanity checker', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const result = poll.updateDescription(
          PollDescription.parse('New clean description'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('addAnswerToQuestion', () => {
      it('should reject profane answer text via Answer.create', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const questionResult = Question.create(
          QuestionText.parse('Test Question'),
          poll.id,
          testCreation(QuestionId, 'question-7'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        let question = expectSuccess(questionResult);
        question = Question.reconstitute({
          ...question.toJSON(),
          answers: question.answers,
          id: 'question-1',
        });
        poll.addQuestion(question);

        const result = poll.addAnswerToQuestion(
          QuestionId.parse('question-1'),
          AnswerText.parse('badword answer'),
          SortOrder.parse(1),
          testCreation(AnswerId, 'answer-10'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean answer text with profanity checker', () => {
        const pollResult = Poll.create(
          PollTitle.parse('Clean title'),
          PollDescription.parse('Clean description'),
          OrganizationId.parse('org-1'),
          BoardId.parse('board-1'),
          UserId.parse('user-1'),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
          ),
          testCreation(PollId, 'poll-1')
        );
        const poll = expectSuccess(pollResult);

        const questionResult = Question.create(
          QuestionText.parse('Test Question'),
          poll.id,
          testCreation(QuestionId, 'question-8'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        let question = expectSuccess(questionResult);
        question = Question.reconstitute({
          ...question.toJSON(),
          answers: question.answers,
          id: 'question-1',
        });
        poll.addQuestion(question);

        const result = poll.addAnswerToQuestion(
          QuestionId.parse('question-1'),
          AnswerText.parse('Clean answer'),
          SortOrder.parse(1),
          testCreation(AnswerId, 'answer-11'),
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
          QuestionText.parse('badword question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-9'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice',
          undefined,
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should reject profane question details', () => {
        const result = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-10'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice',
          QuestionDetails.parse('badword details'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean text with profanity checker', () => {
        const result = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-11'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice',
          QuestionDetails.parse('Clean details'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Question.create(
          QuestionText.parse('badword question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-12'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice',
          QuestionDetails.parse('badword details')
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateText', () => {
      it('should reject profane text', () => {
        const questionResult = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-13'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        const question = expectSuccess(questionResult);

        const result = question.updateText(
          QuestionText.parse('badword text'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean text with profanity checker', () => {
        const questionResult = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-14'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        const question = expectSuccess(questionResult);

        const result = question.updateText(
          QuestionText.parse('New clean text'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateDetails', () => {
      it('should reject profane details', () => {
        const questionResult = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-15'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        const question = expectSuccess(questionResult);

        const result = question.updateDetails(
          QuestionDetails.parse('badword details'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow null details with profanity checker', () => {
        const questionResult = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-16'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice',
          QuestionDetails.parse('Some details')
        );
        const question = expectSuccess(questionResult);

        const result = question.updateDetails(null, mockProfanityChecker);

        expect(result.success).toBe(true);
      });

      it('should allow clean details with profanity checker', () => {
        const questionResult = Question.create(
          QuestionText.parse('Clean question'),
          PollId.parse('poll-1'),
          testCreation(QuestionId, 'question-17'),
          PageNumber.parse(1),
          SortOrder.parse(0),
          'single-choice'
        );
        const question = expectSuccess(questionResult);

        const result = question.updateDetails(
          QuestionDetails.parse('Clean details'),
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
          AnswerText.parse('badword answer'),
          SortOrder.parse(0),
          QuestionId.parse('question-1'),
          testCreation(AnswerId, 'answer-12'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean text with profanity checker', () => {
        const result = Answer.create(
          AnswerText.parse('Clean answer'),
          SortOrder.parse(0),
          QuestionId.parse('question-1'),
          testCreation(AnswerId, 'answer-13'),
          mockProfanityChecker
        );

        expect(result.success).toBe(true);
      });

      it('should skip profanity check when checker not provided', () => {
        const result = Answer.create(
          AnswerText.parse('badword answer'),
          SortOrder.parse(0),
          QuestionId.parse('question-1'),
          testCreation(AnswerId, 'answer-14')
        );

        expect(result.success).toBe(true);
      });
    });

    describe('updateText', () => {
      it('should reject profane text', () => {
        const answerResult = Answer.create(
          AnswerText.parse('Clean answer'),
          SortOrder.parse(0),
          QuestionId.parse('question-1'),
          testCreation(AnswerId, 'answer-15')
        );
        const answer = expectSuccess(answerResult);

        const result = answer.updateText(
          AnswerText.parse('badword text'),
          mockProfanityChecker
        );

        expect(result.success).toBe(false);
        expect(expectFailure(result)).toBe(
          SharedDomainCodes.CONTAINS_PROFANITY
        );
      });

      it('should allow clean text with profanity checker', () => {
        const answerResult = Answer.create(
          AnswerText.parse('Clean answer'),
          SortOrder.parse(0),
          QuestionId.parse('question-1'),
          testCreation(AnswerId, 'answer-16')
        );
        const answer = expectSuccess(answerResult);

        const result = answer.updateText(
          AnswerText.parse('New clean text'),
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

  function createPoll(boardId: string | null, pollType?: PollType) {
    return Poll.create(
      PollTitle.parse('Title'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      boardId === null ? null : BoardId.parse(boardId),
      UserId.parse('user-1'),
      expectSuccess(PollPeriod.create(startDate, endDate)),
      testCreation(PollId, 'poll-1'),
      undefined,
      pollType
    );
  }

  it('should default to ORGANIZATION', () => {
    const result = createPoll(null);

    expect(result.success).toBe(true);
    expect(expectSuccess(result).pollType).toBe('ORGANIZATION');
    expect(expectSuccess(result).isOpen()).toBe(false);
  });

  it('should create an OPEN poll with equal weight defaults', () => {
    const result = createPoll(null, 'OPEN');

    expect(result.success).toBe(true);
    expect(expectSuccess(result).isOpen()).toBe(true);
    expect(expectSuccess(result).distributionType).toBe('EQUAL');
    expect(expectSuccess(result).propertyAggregation).toBe('RAW_SUM');
    expect(expectSuccess(result).propertyIds).toEqual([]);
  });

  it('should reject an OPEN poll scoped to a board', () => {
    const result = createPoll('board-1', 'OPEN');

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(
      PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED
    );
  });

  it('should reject an unknown poll type', () => {
    // @ts-expect-error Runtime defense against an unchecked caller.
    const result = createPoll(null, 'WHATEVER');

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_TYPE_INVALID);
  });

  describe('applyWeightConfig', () => {
    it('should accept the equal defaults on an OPEN poll', () => {
      const poll = expectSuccess(createPoll(null, 'OPEN'));

      const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', []);

      expect(result.success).toBe(true);
    });

    it('should reject ownership weighting on an OPEN poll', () => {
      const poll = expectSuccess(createPoll(null, 'OPEN'));

      const result = poll.applyWeightConfig(
        'OWNERSHIP_UNIT_COUNT',
        'RAW_SUM',
        []
      );

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL
      );
      expect(poll.distributionType).toBe('EQUAL');
    });

    it('should reject a property scope on an OPEN poll', () => {
      const poll = expectSuccess(createPoll(null, 'OPEN'));

      const result = poll.applyWeightConfig('EQUAL', 'RAW_SUM', [
        PropertyId.parse('prop-1'),
      ]);

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_OPEN_MUST_BE_EQUAL
      );
      expect(poll.propertyIds).toEqual([]);
    });

    it('should still work normally on an ORGANIZATION poll', () => {
      const poll = expectSuccess(createPoll(null));

      const result = poll.applyWeightConfig(
        'OWNERSHIP_UNIT_COUNT',
        'NORMALIZE_PER_PROPERTY',
        [PropertyId.parse('prop-1')]
      );

      expect(result.success).toBe(true);
      expect(poll.distributionType).toBe('OWNERSHIP_UNIT_COUNT');
      expect(poll.propertyAggregation).toBe('NORMALIZE_PER_PROPERTY');
      expect(poll.propertyIds).toEqual(['prop-1']);
    });
  });

  describe('anonymous flag', () => {
    function create(pollType?: PollType, anonymous?: boolean) {
      return Poll.create(
        PollTitle.parse('Title'),
        PollDescription.parse('Description'),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-01'), new Date('2026-02-01'))
        ),
        testCreation(PollId, 'poll-1'),
        undefined,
        pollType,
        anonymous
      );
    }

    it('should default to named', () => {
      const result = create();

      expect(result.success).toBe(true);
      expect(expectSuccess(result).isAnonymous()).toBe(false);
    });

    it('should create an anonymous poll when asked', () => {
      const result = create('ORGANIZATION', true);

      expect(result.success).toBe(true);
      expect(expectSuccess(result).isAnonymous()).toBe(true);
    });

    it('should allow an anonymous OPEN poll', () => {
      const result = create('OPEN', true);

      expect(result.success).toBe(true);
      expect(expectSuccess(result).isAnonymous()).toBe(true);
    });

    it('should allow a named OPEN poll', () => {
      const result = create('OPEN', false);

      expect(result.success).toBe(true);
      expect(expectSuccess(result).isAnonymous()).toBe(false);
    });

    it('should round-trip through reconstitute', () => {
      const created = expectSuccess(create('ORGANIZATION', true));

      const restored = Poll.reconstitute(created.toJSON() as any);

      expect(restored.isAnonymous()).toBe(true);
    });

    it('should expose no mutator for the flag', () => {
      const poll = expectSuccess(create());

      expect((poll as any).setAnonymous).toBeUndefined();
    });
  });

  describe('description attachments', () => {
    function draftPoll(): Poll {
      const r = Poll.create(
        PollTitle.parse('Fence dispute'),
        PollDescription.parse('The fence was moved.'),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2030-01-01'), new Date('2030-02-01'))
        ),
        testCreation(PollId, 'poll-1')
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
      const result = poll.addAttachment(PollAttachmentId.parse('att1'));

      expect(result.success).toBe(true);
      expect(poll.attachmentIds).toEqual(['att1']);
    });

    it('should reject adding past the count limit', () => {
      const poll = draftPoll();

      for (let i = 0; i < POLL_ATTACHMENT_COUNT_LIMIT; i++) {
        expect(
          poll.addAttachment(PollAttachmentId.parse(`att${i}`)).success
        ).toBe(true);
      }

      const result = poll.addAttachment(PollAttachmentId.parse('one-too-many'));

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED
      );
    });

    it('should remove an attachment id', () => {
      const poll = draftPoll();
      poll.addAttachment(PollAttachmentId.parse('att1'));

      const result = poll.removeAttachment(PollAttachmentId.parse('att1'));

      expect(result.success).toBe(true);
      expect(poll.attachmentIds).toEqual([]);
    });

    it('should fail to remove an attachment that is not attached', () => {
      const poll = draftPoll();
      const result = poll.removeAttachment(PollAttachmentId.parse('nope'));

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND
      );
    });

    // attachmentIds lives outside `props`, so the spread in toJSON would
    // silently drop it without an explicit key. Serialized poll payloads feed
    // the description renderer's allowlist; an empty list there makes every
    // inline image render as a blocked placeholder.
    it('should include attachmentIds in toJSON', () => {
      const poll = draftPoll();
      poll.addAttachment(PollAttachmentId.parse('att1'));
      poll.addAttachment(PollAttachmentId.parse('att2'));

      expect(poll.toJSON().attachmentIds).toEqual(['att1', 'att2']);
    });

    it('should serialize an empty attachment list rather than undefined', () => {
      expect(draftPoll().toJSON().attachmentIds).toEqual([]);
    });

    it('should not leak internal state through the getter', () => {
      const poll = draftPoll();
      poll.addAttachment(PollAttachmentId.parse('att1'));

      poll.attachmentIds.push(PollAttachmentId.parse('injected'));

      expect(poll.attachmentIds).toEqual(['att1']);
    });

    it('should fail to add an attachment once the poll is active', () => {
      const poll = draftPoll();
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = poll.addAttachment(PollAttachmentId.parse('att1'));

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
      );
    });

    it('should fail to remove an attachment once the poll is active', () => {
      const poll = draftPoll();
      poll.addAttachment(PollAttachmentId.parse('att1'));
      poll.addQuestion(createQuestionWithAnswer(poll.id));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = poll.removeAttachment(PollAttachmentId.parse('att1'));

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE
      );
    });
  });

  describe('updateDescription attachment refs', () => {
    function draftPollWithAttachment(): Poll {
      const r = Poll.create(
        PollTitle.parse('Fence dispute'),
        PollDescription.parse('Initial text.'),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2030-01-01'), new Date('2030-02-01'))
        ),
        testCreation(PollId, 'poll-1')
      );

      if (!r.success) {
        throw new Error('fixture poll failed to build: ' + r.error);
      }

      r.value.addAttachment(PollAttachmentId.parse('own1'));

      return r.value;
    }

    it('should accept a description referencing its own attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        PollDescription.parse('See ![photo](/api/poll-attachments/own1)')
      );

      expect(result.success).toBe(true);
    });

    it('should reject a description referencing a foreign attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        PollDescription.parse('See ![photo](/api/poll-attachments/foreign9)')
      );

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(
        PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
      );
    });

    it('should accept a PDF link ref to its own attachment', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        PollDescription.parse('See [survey.pdf](/api/poll-attachments/own1)')
      );

      expect(result.success).toBe(true);
    });

    it('should ignore a report-attachment URL, which is not a poll ref', () => {
      const poll = draftPollWithAttachment();
      const result = poll.updateDescription(
        PollDescription.parse('See ![x](/api/report-attachments/other1)')
      );

      expect(result.success).toBe(true);
    });

    // A brand-new poll owns no attachments, so any ref in its initial
    // description necessarily points at another poll's file.
    it('should reject creating a poll whose description already has a ref', () => {
      const result = Poll.create(
        PollTitle.parse('Fence dispute'),
        PollDescription.parse(
          'See ![photo](/api/poll-attachments/someone-elses-file)'
        ),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2030-01-01'), new Date('2030-02-01'))
        ),
        testCreation(PollId, 'poll-1')
      );

      expect(result.success).toBe(false);
      expect(result.success === false && result.error).toBe(
        PollDomainCodes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF
      );
    });
  });
});
