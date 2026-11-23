/** Application client regressions exercise typed question/answer creation and editing.
 * Raw requests remain transport values; fixtures supply deterministic identity/time. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
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
import { questionClock } from './questionTestValues';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteAnswerUseCase } from '../DeleteAnswerUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('DeleteAnswerUseCase', () => {
  let useCase: DeleteAnswerUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let answerRepository: Partial<AnswerRepository>;
  let voteRepository: Partial<VoteRepository>;
  let userRepository: Partial<UserRepository>;
  let poll: Poll;
  let question: Question;
  let answer: Answer;

  beforeEach(() => {
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

    const questionResult = Question.create(
      QuestionText.parse('Test Question'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    question = expectSuccess(questionResult);

    const answerResult = Answer.create(
      AnswerText.parse('Test Answer'),
      SortOrder.parse(0),
      QuestionId.parse('question-1'),
      testCreation(AnswerId, 'answer-1')
    );
    answer = expectSuccess(answerResult);

    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    questionRepository = {
      getQuestionById: vi.fn().mockResolvedValue(success(question)),
    };

    answerRepository = {
      getAnswerById: vi.fn().mockResolvedValue(success(answer)),
      updateAnswer: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new DeleteAnswerUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository,
      answerRepository as AnswerRepository,
      voteRepository as VoteRepository,
      userRepository as UserRepository,
      questionClock
    );
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to delete answer', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'superadmin-1',
      });

      expect(result.success).toBe(true);
      expect(answerRepository.updateAnswer).toHaveBeenCalledWith(answer);
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-2',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should allow creator (not superadmin) to delete answer', async () => {
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
    });
  });
});
