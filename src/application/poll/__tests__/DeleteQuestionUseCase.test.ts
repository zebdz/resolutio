import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteQuestionUseCase } from '../DeleteQuestionUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('DeleteQuestionUseCase', () => {
  let useCase: DeleteQuestionUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let voteRepository: Partial<VoteRepository>;
  let poll: Poll;
  let question: Question;

  beforeEach(() => {
    // Create a poll
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

    // Create a question
    const questionResult = Question.create(
      'Question to delete',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    question = questionResult.value;
    (question as any).props.id = 'question-1';

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    questionRepository = {
      getQuestionById: vi.fn().mockResolvedValue(success(question)),
      deleteQuestion: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    useCase = new DeleteQuestionUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository,
      voteRepository as VoteRepository
    );
  });

  it('should delete (archive) question when user is poll creator and poll is editable', async () => {
    const result = await useCase.execute({
      questionId: 'question-1',
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(questionRepository.deleteQuestion).toHaveBeenCalledWith(
      'question-1'
    );
  });

  it('should fail when question not found', async () => {
    questionRepository.getQuestionById = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      questionId: 'non-existent',
      userId: 'user-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.QUESTION_NOT_FOUND);
  });

  it('should fail when user is not poll creator', async () => {
    const result = await useCase.execute({
      questionId: 'question-1',
      userId: 'user-2',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
  });

  it('should fail when poll is active', async () => {
    // Activate poll (need question with answer)
    const questionForActivation = Question.create(
      'Temp Question',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    const tempAnswer = Answer.create(
      'Temp Answer',
      1,
      questionForActivation.value.id
    );
    questionForActivation.value.addAnswer(tempAnswer.value);
    poll.addQuestion(questionForActivation.value);
    poll.takeSnapshot();
    poll.activate();

    const result = await useCase.execute({
      questionId: 'question-1',
      userId: 'user-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
  });

  it('should fail when poll has votes', async () => {
    voteRepository.pollHasVotes = vi.fn().mockResolvedValue(success(true));

    const result = await useCase.execute({
      questionId: 'question-1',
      userId: 'user-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
  });
});
