import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { UserId } from '@/domain/shared/EntityIds';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { QuestionId, AnswerId, PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdatePollUseCase } from '../UpdatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('UpdatePollUseCase', () => {
  let useCase: UpdatePollUseCase;
  let pollRepository: Partial<PollRepository>;
  let voteRepository: Partial<VoteRepository>;
  let userRepository: Partial<UserRepository>;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      PollTitle.parse('Original Title'),
      PollDescription.parse('Original Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new UpdatePollUseCase(
      pollRepository as PollRepository,
      voteRepository as VoteRepository,
      userRepository as UserRepository
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
      expect(expectFailure(result)).toBe(PollErrors.NOT_FOUND);
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
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      // Add a question with answer and activate poll
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        pollFixtureCreation(QuestionId),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const answerResult = Answer.create(
        AnswerText.parse('Test Answer'),
        SortOrder.parse(1),
        expectSuccess(questionResult).id,
        pollFixtureCreation(AnswerId)
      );
      expectSuccess(questionResult).addAnswer(expectSuccess(answerResult));
      poll.addQuestion(expectSuccess(questionResult));
      poll.submitToAdmin();
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
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll is finished', async () => {
      // Add a question with answer and transition to FINISHED
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        pollFixtureCreation(QuestionId),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const answerResult = Answer.create(
        AnswerText.parse('Test Answer'),
        SortOrder.parse(1),
        expectSuccess(questionResult).id,
        pollFixtureCreation(AnswerId)
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
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
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
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to update poll', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'superadmin-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(true);
      expect(pollRepository.updatePoll).toHaveBeenCalled();
    });

    it('should reject non-creator non-superadmin', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-2',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should still allow creator (not superadmin) to update poll', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(true);
    });
  });
});
