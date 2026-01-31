import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdatePollUseCase } from '../UpdatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('UpdatePollUseCase', () => {
  let useCase: UpdatePollUseCase;
  let pollRepository: Partial<PollRepository>;
  let voteRepository: Partial<VoteRepository>;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Original Title',
      'Original Description',
      'board-1',
      'user-1',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    useCase = new UpdatePollUseCase(
      pollRepository as PollRepository,
      voteRepository as VoteRepository
    );
  });

  describe('updatePollBasicInfo', () => {
    it('should update poll basic info when user is creator and poll is not active/finished/has votes', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(true);
      expect(pollRepository.updatePoll).toHaveBeenCalled();
    });

    it('should fail when poll not found', async () => {
      pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

      const result = await useCase.execute({
        pollId: 'non-existent',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    });

    it('should fail when user is not the poll creator', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-2',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      // Add a question with answer and activate poll
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

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll is finished', async () => {
      // Add a question with answer and transition to FINISHED
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
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    });

    it('should fail when poll has votes', async () => {
      voteRepository.pollHasVotes = vi.fn().mockResolvedValue(success(true));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });
});
