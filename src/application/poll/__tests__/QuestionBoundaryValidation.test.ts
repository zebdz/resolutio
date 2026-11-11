/** Raw question-edit requests must be decoded before repository access.
 * Partial port doubles deliberately fail if invalid data escapes the boundary. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { SortOrder } from '@/domain/poll/QuestionValues';
import { describe, expect, it, vi } from 'vitest';
import { UpdateQuestionOrderUseCase } from '../UpdateQuestionOrderUseCase';
import { PollRepository } from '@/domain/poll/PollRepository';
import { QuestionRepository } from '@/domain/poll/QuestionRepository';
import { UserRepository } from '@/domain/user/UserRepository';
import { UpdateQuestionUseCase } from '../UpdateQuestionUseCase';
import { DeleteQuestionUseCase } from '../DeleteQuestionUseCase';
import { CreateAnswerUseCase } from '../CreateAnswerUseCase';
import { UpdateAnswerUseCase } from '../UpdateAnswerUseCase';
import { DeleteAnswerUseCase } from '../DeleteAnswerUseCase';
import { AddQuestionUseCase } from '../AddQuestionUseCase';
import { AnswerRepository } from '@/domain/poll/AnswerRepository';
import { VoteRepository } from '@/domain/poll/VoteRepository';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';
import { Question } from '@/domain/poll/Question';
import { Answer } from '@/domain/poll/Answer';
import { Poll } from '@/domain/poll/Poll';
import {
  AnswerId,
  QuestionId,
  PollId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { success } from '@/domain/shared/Result';
import { PollErrors } from '../PollErrors';

const clock: Clock = { now: () => Instant.parse('2026-01-01T00:00:00.000Z') };
const ids: IdGenerator = { generate: (schema) => schema.parse('generated-id') };

describe('Question edit request boundary', () => {
  it('assigns validated question and answer identities before persistence', async () => {
    const poll = Poll.create(
      PollTitle.parse('Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      null,
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-02-01T00:00:00.000Z')
        )
      ),
      testCreation(PollId, 'poll-1')
    );

    if (!poll.success) {
      throw new Error(poll.error);
    }

    let savedQuestion: Question | undefined;
    const savedAnswers: Answer[] = [];
    let nextIdentity = 1;
    const generator: IdGenerator = {
      generate: (schema) => schema.parse(`created-${nextIdentity++}`),
    };
    const useCase = new AddQuestionUseCase(
      {
        getPollById: vi.fn().mockResolvedValue(poll),
      } as unknown as PollRepository,
      {
        createQuestion: async (question: Question) => {
          savedQuestion = question;

          return success(question);
        },
        getQuestionById: async () =>
          success(
            savedQuestion
              ? Question.reconstitute({
                  ...savedQuestion.toJSON(),
                  answers: savedAnswers,
                })
              : null
          ),
      } as unknown as QuestionRepository,
      {
        createAnswer: async (answer: Answer) => {
          savedAnswers.push(answer);

          return success(answer);
        },
      } as unknown as AnswerRepository,
      {
        isSuperAdmin: vi.fn().mockResolvedValue(false),
      } as unknown as UserRepository,
      generator,
      clock
    );
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'Choose',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Yes', 'No'],
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe('created-1');
      expect(result.value.answers.map((answer) => answer.id)).toEqual([
        'created-2',
        'created-3',
      ]);
      expect(
        result.value.answers.every(
          (answer) => answer.questionId === result.value.id
        )
      ).toBe(true);
      expect(result.value.createdAt.toISOString()).toBe(clock.now());
    }
  });
  it('never reorders a question outside the authorized poll', async () => {
    const poll = Poll.create(
      PollTitle.parse('Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      null,
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-02-01T00:00:00.000Z')
        )
      ),
      testCreation(PollId, 'poll-1')
    );

    if (!poll.success) {
      throw new Error(poll.error);
    }

    const updateQuestionOrder = vi.fn().mockResolvedValue(success(undefined));
    const useCase = new UpdateQuestionOrderUseCase(
      {
        getPollById: vi.fn().mockResolvedValue(poll),
      } as unknown as PollRepository,
      { updateQuestionOrder } as unknown as QuestionRepository,
      {
        isSuperAdmin: vi.fn().mockResolvedValue(false),
      } as unknown as UserRepository
    );
    expect(
      await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        updates: [{ questionId: 'foreign-question', page: 1, order: 0 }],
      })
    ).toEqual({ success: false, error: PollErrors.QUESTION_NOT_FOUND });
    expect(updateQuestionOrder).not.toHaveBeenCalled();
  });
  it('archives answers/questions at the supplied clock instant through domain behavior', async () => {
    const poll = Poll.create(
      PollTitle.parse('Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      null,
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(
          new Date('2026-01-01T00:00:00.000Z'),
          new Date('2026-02-01T00:00:00.000Z')
        )
      ),
      testCreation(PollId, 'poll-1')
    );
    const question = Question.create(
      QuestionText.parse('Choose'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1')
    );
    const answer = Answer.create(
      AnswerText.parse('Yes'),
      SortOrder.parse(0),
      QuestionId.parse('question-1'),
      testCreation(AnswerId, 'answer-1')
    );

    if (!poll.success || !question.success || !answer.success) {
      throw new Error('Invalid fixture');
    }

    const polls = {
      getPollById: vi.fn().mockResolvedValue(poll),
    } as unknown as PollRepository;
    const questions = {
      getQuestionById: vi.fn().mockResolvedValue(question),
      updateQuestion: vi.fn().mockResolvedValue(success(undefined)),
      deleteQuestion: vi.fn().mockResolvedValue(success(undefined)),
    };
    const answers = {
      getAnswerById: vi.fn().mockResolvedValue(answer),
      updateAnswer: vi.fn().mockResolvedValue(success(undefined)),
      deleteAnswer: vi.fn().mockResolvedValue(success(undefined)),
    };
    const votes = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    } as unknown as VoteRepository;
    const users = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    } as unknown as UserRepository;
    const at = Instant.parse('2026-01-03T00:00:00.000Z');
    const suppliedClock = { now: () => at };
    const deleteAnswer = new DeleteAnswerUseCase(
      polls,
      questions as unknown as QuestionRepository,
      answers as unknown as AnswerRepository,
      votes,
      users,
      suppliedClock
    );
    const deleteQuestion = new DeleteQuestionUseCase(
      polls,
      questions as unknown as QuestionRepository,
      votes,
      users,
      suppliedClock
    );
    expect(
      (
        await deleteAnswer.execute({
          answerId: answer.value.id,
          userId: 'user-1',
        })
      ).success
    ).toBe(true);
    expect(answer.value.archivedAt?.toISOString()).toBe(at);
    expect(answers.updateAnswer).toHaveBeenCalledWith(answer.value);
    expect(
      (
        await deleteQuestion.execute({
          questionId: question.value.id,
          userId: 'user-1',
        })
      ).success
    ).toBe(true);
    expect(question.value.archivedAt?.toISOString()).toBe(at);
    expect(questions.updateQuestion).toHaveBeenCalledWith(question.value);
  });
  it('decodes every raw question/answer editing identity before repository access', async () => {
    const fail = vi.fn(() => {
      throw new Error('Unexpected repository access');
    });
    const polls = { getPollById: fail } as unknown as PollRepository;
    const questions = {
      getQuestionById: fail,
    } as unknown as QuestionRepository;
    const answers = { getAnswerById: fail } as unknown as AnswerRepository;
    const users = {} as UserRepository;
    const votes = {} as VoteRepository;
    const invalidQuestion = {
      questionId: 'invalid question',
      userId: 'user-1',
    };
    const invalidAnswer = { answerId: 'invalid answer', userId: 'user-1' };
    const executions = [
      () =>
        new AddQuestionUseCase(
          polls,
          questions,
          answers,
          users,
          ids,
          clock
        ).execute({
          pollId: 'invalid poll',
          userId: 'user-1',
          text: 'Choose',
          page: 1,
          order: 0,
          questionType: 'single-choice',
          answers: ['Yes'],
        }),
      () =>
        new UpdateQuestionUseCase(polls, questions, votes, users).execute(
          invalidQuestion
        ),
      () =>
        new DeleteQuestionUseCase(
          polls,
          questions,
          votes,
          users,
          clock
        ).execute(invalidQuestion),
      () =>
        new CreateAnswerUseCase(
          polls,
          questions,
          answers,
          votes,
          users,
          ids,
          clock
        ).execute({ ...invalidQuestion, text: 'Yes', order: 0 }),
      () =>
        new UpdateAnswerUseCase(
          polls,
          questions,
          answers,
          votes,
          users
        ).execute(invalidAnswer),
      () =>
        new DeleteAnswerUseCase(
          polls,
          questions,
          answers,
          votes,
          users,
          clock
        ).execute(invalidAnswer),
    ];

    for (const execute of executions) {
      await expect(execute()).resolves.toEqual({
        success: false,
        error: 'common.errors.validationFailed',
      });
    }

    expect(fail).not.toHaveBeenCalled();
  });
  it('rejects malformed identities before accessing repositories', async () => {
    const getPollById = vi.fn(() => {
      throw new Error('Unexpected repository access');
    });
    const useCase = new UpdateQuestionOrderUseCase(
      { getPollById } as unknown as PollRepository,
      {} as QuestionRepository,
      {} as UserRepository
    );

    await expect(
      useCase.execute({
        pollId: 'invalid poll',
        userId: 'user-1',
        updates: [],
      })
    ).resolves.toEqual({
      success: false,
      error: 'common.errors.validationFailed',
    });
    expect(getPollById).not.toHaveBeenCalled();
  });
});
