/** Application client regressions exercise typed question/answer creation and editing.
 * Raw requests remain transport values; fixtures supply deterministic identity/time. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import {
  QuestionText,
  AnswerText,
  QuestionDetails,
} from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { UserId } from '@/domain/shared/EntityIds';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollId } from '@/domain/shared/EntityIds';
import { QuestionId, AnswerId } from '@/domain/shared/EntityIds';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateQuestionUseCase } from '../UpdateQuestionUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('UpdateQuestionUseCase', () => {
  let useCase: UpdateQuestionUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let voteRepository: Partial<VoteRepository>;
  let userRepository: Partial<UserRepository>;
  let poll: Poll;
  let question: Question;

  beforeEach(() => {
    // Create a poll
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
    poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });

    // Create a question
    const questionResult = Question.create(
      QuestionText.parse('Original Question'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    question = expectSuccess(questionResult);

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    questionRepository = {
      getQuestionById: vi.fn().mockResolvedValue(success(question)),
      updateQuestion: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new UpdateQuestionUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository,
      voteRepository as VoteRepository,
      userRepository as UserRepository
    );
  });

  describe('updating question text', () => {
    it('should update question text when user is poll creator and poll is editable', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        text: 'Updated Question',
      });

      expect(result.success).toBe(true);
      expect(questionRepository.updateQuestion).toHaveBeenCalled();
    });

    it('should fail when question not found', async () => {
      questionRepository.getQuestionById = vi
        .fn()
        .mockResolvedValue(success(null));

      const result = await useCase.execute({
        questionId: 'non-existent',
        userId: 'user-1',
        text: 'Updated Question',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.QUESTION_NOT_FOUND);
    });

    it('should fail when user is not poll creator', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-2',
        text: 'Updated Question',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      // Activate poll (need question with answer)
      const questionForActivation = Question.create(
        QuestionText.parse('Temp Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const tempAnswer = Answer.create(
        AnswerText.parse('Temp Answer'),
        SortOrder.parse(1),
        expectSuccess(questionForActivation).id,
        testCreation(AnswerId, 'answer-1')
      );
      expectSuccess(questionForActivation).addAnswer(expectSuccess(tempAnswer));
      poll.addQuestion(expectSuccess(questionForActivation));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        text: 'Updated Question',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll has votes', async () => {
      voteRepository.pollHasVotes = vi.fn().mockResolvedValue(success(true));

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        text: 'Updated Question',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });

  describe('updating question details', () => {
    it('should update question details', async () => {
      // Create question with details
      const questionWithDetails = Question.create(
        QuestionText.parse('Original Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice',
        QuestionDetails.parse('Original details')
      );
      questionRepository.getQuestionById = vi
        .fn()
        .mockResolvedValue(success(expectSuccess(questionWithDetails)));

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        details: 'Updated details',
      });

      expect(result.success).toBe(true);
      expect(questionRepository.updateQuestion).toHaveBeenCalled();
    });
  });

  describe('updating question type', () => {
    it('should update question type from single-choice to multiple-choice', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        questionType: 'multiple-choice',
      });

      expect(result.success).toBe(true);
      expect(questionRepository.updateQuestion).toHaveBeenCalled();
    });
  });

  describe('updating multiple properties at once', () => {
    it('should update text, details, and type together', async () => {
      // Create question with details
      const questionWithDetails = Question.create(
        QuestionText.parse('Original Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice',
        QuestionDetails.parse('Original details')
      );
      questionRepository.getQuestionById = vi
        .fn()
        .mockResolvedValue(success(expectSuccess(questionWithDetails)));

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        text: 'Updated Question',
        details: 'Updated details',
        questionType: 'multiple-choice',
      });

      expect(result.success).toBe(true);
      expect(questionRepository.updateQuestion).toHaveBeenCalled();
    });
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to update question', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'superadmin-1',
        text: 'Updated Question',
      });

      expect(result.success).toBe(true);
      expect(questionRepository.updateQuestion).toHaveBeenCalled();
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-2',
        text: 'Updated Question',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });
  });
});
