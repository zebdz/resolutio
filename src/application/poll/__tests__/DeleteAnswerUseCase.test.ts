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

    const answerResult = Answer.create('Test Answer', 0, 'question-1');
    answer = answerResult.value;
    (answer as any).props.id = 'answer-1';

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    questionRepository = {
      getQuestionById: vi.fn().mockResolvedValue(success(question)),
    };

    answerRepository = {
      getAnswerById: vi.fn().mockResolvedValue(success(answer)),
      deleteAnswer: vi.fn().mockResolvedValue(success(undefined)),
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
      userRepository as UserRepository
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
      expect(answerRepository.deleteAnswer).toHaveBeenCalledWith('answer-1');
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
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
