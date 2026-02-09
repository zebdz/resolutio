import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateAnswerUseCase } from '../CreateAnswerUseCase';
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

describe('CreateAnswerUseCase', () => {
  let useCase: CreateAnswerUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let answerRepository: Partial<AnswerRepository>;
  let voteRepository: Partial<VoteRepository>;
  let userRepository: Partial<UserRepository>;
  let poll: Poll;
  let question: Question;

  beforeEach(() => {
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'user-1',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    const questionResult = Question.create(
      'Test Question',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    question = questionResult.value;
    (question as any).props.id = 'question-1';

    const existingAnswer = Answer.create('Existing', 0, 'question-1');
    question.addAnswer(existingAnswer.value);
    poll.addQuestion(question);

    questionRepository = {
      getQuestionById: vi.fn().mockResolvedValue(success(question)),
    };

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    answerRepository = {
      createAnswer: vi.fn().mockImplementation(async (answer: Answer) => {
        (answer as any).props.id = 'new-answer-id';

        return success(answer);
      }),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new CreateAnswerUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository,
      answerRepository as AnswerRepository,
      voteRepository as VoteRepository,
      userRepository as UserRepository
    );
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to create answer', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'superadmin-1',
        text: 'New Answer',
        order: 1,
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-2',
        text: 'New Answer',
        order: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should allow creator (not superadmin) to create answer', async () => {
      const result = await useCase.execute({
        questionId: 'question-1',
        userId: 'user-1',
        text: 'New Answer',
        order: 1,
      });

      expect(result.success).toBe(true);
    });
  });
});
