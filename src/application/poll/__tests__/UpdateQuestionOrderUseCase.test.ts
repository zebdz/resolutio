import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateQuestionOrderUseCase } from '../UpdateQuestionOrderUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('UpdateQuestionOrderUseCase', () => {
  let useCase: UpdateQuestionOrderUseCase;
  let pollRepository: Partial<PollRepository>;
  let questionRepository: Partial<QuestionRepository>;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'org-1',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    questionRepository = {
      updateQuestionOrder: vi.fn().mockResolvedValue(success(undefined)),
    };

    useCase = new UpdateQuestionOrderUseCase(
      pollRepository as PollRepository,
      questionRepository as QuestionRepository
    );
  });

  it('should reorder questions within the same page', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
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
      'Test Question',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    const answerResult = Answer.create(
      'Test Answer',
      1,
      questionResult.value.id
    );
    questionResult.value.addAnswer(answerResult.value);
    poll.addQuestion(questionResult.value);
    poll.takeSnapshot();
    poll.activate();
    poll.finish();

    const result = await useCase.execute({
      pollId: 'poll-1',
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
});
