import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinishPollUseCase } from '../FinishPollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { DraftRepository } from '../../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';

describe('FinishPollUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let draftRepository: Partial<DraftRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: FinishPollUseCase;
  let poll: Poll;

  beforeEach(() => {
    // Create a test poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'user-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    expect(pollResult.success).toBe(true);
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Add a question with answer
    const questionResult = Question.create(
      'Question 1',
      poll.id,
      1,
      1,
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    const question = questionResult.value;
    (question as any).props.id = 'question-1';

    // Add answer
    const answerResult = Answer.create('Answer 1', 1, question.id);
    (answerResult.value as any).props.id = 'answer-1';
    question.addAnswer(answerResult.value);

    poll.addQuestion(question);

    // Take snapshot and activate the poll
    poll.takeSnapshot();
    poll.activate();

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    draftRepository = {
      deleteAllPollDrafts: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new FinishPollUseCase(
      pollRepository as PollRepository,
      draftRepository as DraftRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository
    );
  });

  it('should finish an active poll', async () => {
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);
    expect(pollRepository.updatePoll).toHaveBeenCalled();
  });

  it('should delete all drafts when finishing poll', async () => {
    await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(draftRepository.deleteAllPollDrafts).toHaveBeenCalledWith(poll.id);
  });

  it('should fail if poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is already finished', async () => {
    poll.finish();

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
  });

  it('should fail if poll is in READY state (not active)', async () => {
    poll.deactivate(); // moves to READY

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
  });

  // Authorization tests
  describe('authorization', () => {
    it('should reject non-admin user', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    });

    it('should allow admin user', async () => {
      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    it('should allow superadmin even if not org admin', async () => {
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'super-user',
      });

      expect(result.success).toBe(true);
    });
  });
});
