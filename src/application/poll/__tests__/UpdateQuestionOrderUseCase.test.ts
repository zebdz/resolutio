/** Application client regressions exercise typed question/answer creation and editing.
 * Raw requests remain transport values; fixtures supply deterministic identity/time. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { SortOrder, PageNumber } from '@/domain/poll/QuestionValues';
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
import { UpdateQuestionOrderUseCase } from '../UpdateQuestionOrderUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('UpdateQuestionOrderUseCase', () => {
  let useCase: UpdateQuestionOrderUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let userRepository: Partial<UserRepository>;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });

    // Reorder only questions actually owned by this poll.
    for (let index = 1; index <= 5; index++) {
      const question = Question.create(
        QuestionText.parse(`Question ${index}`),
        poll.id,
        testCreation(QuestionId, `q-${index}`)
      );

      if (!question.success) {
        throw new Error(question.error);
      }

      const answer = Answer.create(
        AnswerText.parse('Yes'),
        SortOrder.parse(0),
        question.value.id,
        testCreation(AnswerId, `answer-q-${index}`)
      );

      if (!answer.success) {
        throw new Error(answer.error);
      }

      question.value.addAnswer(answer.value);
      poll.addQuestion(question.value);
    }

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    questionRepository = {
      updateQuestionOrder: vi.fn().mockResolvedValue(success(undefined)),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new UpdateQuestionOrderUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository,
      userRepository as UserRepository
    );
  });

  it('should reorder questions within the same page', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      updates: [
        { questionId: 'q-3', page: 1, order: 0 },
        { questionId: 'q-1', page: 1, order: 1 },
        { questionId: 'q-2', page: 1, order: 2 },
      ],
    });

    expect(result.success).toBe(true);
    expect(questionRepository.updateQuestionOrder).toHaveBeenCalledWith([
      { questionId: 'q-3', page: 1, order: 0 },
      { questionId: 'q-1', page: 1, order: 1 },
      { questionId: 'q-2', page: 1, order: 2 },
    ]);
  });

  it('should move question to a different page', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      updates: [
        { questionId: 'q-2', page: 2, order: 0 },
        { questionId: 'q-3', page: 2, order: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(questionRepository.updateQuestionOrder).toHaveBeenCalled();
  });

  it('should fail when poll does not exist', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent-poll',
      userId: 'user-1',
      updates: [{ questionId: 'q-1', page: 1, order: 0 }],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should fail when poll is finished', async () => {
    // Add question with answer and transition to FINISHED
    const questionResult = Question.create(
      QuestionText.parse('Test Question'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    const answerResult = Answer.create(
      AnswerText.parse('Test Answer'),
      SortOrder.parse(1),
      expectSuccess(questionResult).id,
      testCreation(AnswerId, 'answer-1')
    );
    expectSuccess(questionResult).addAnswer(expectSuccess(answerResult));
    poll.addQuestion(expectSuccess(questionResult));
    poll.submitToAdmin();
    poll.takeSnapshot();
    poll.activate();
    poll.finish(PollInstant.parse(new Date().toISOString()));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      updates: [{ questionId: 'q-1', page: 1, order: 1 }],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    }
  });

  it('should handle complex reordering across multiple pages', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      updates: [
        { questionId: 'q-1', page: 1, order: 0 },
        { questionId: 'q-4', page: 1, order: 1 }, // Moved from page 2
        { questionId: 'q-3', page: 1, order: 2 },
        { questionId: 'q-2', page: 2, order: 0 }, // Moved from page 1
        { questionId: 'q-5', page: 2, order: 1 },
      ],
    });

    expect(result.success).toBe(true);
    expect(questionRepository.updateQuestionOrder).toHaveBeenCalled();
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to reorder questions', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'superadmin-1',
        updates: [{ questionId: 'q-1', page: 1, order: 0 }],
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-2',
        updates: [{ questionId: 'q-1', page: 1, order: 0 }],
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });
  });
});
