/** Verifies Finish Poll behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
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
import {
  pollFixtureCreation,
  pollFixtureIds,
  pollFixtureClock,
} from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { QuestionId, AnswerId, PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinishPollUseCase } from '../FinishPollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { DraftRepository } from '../../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Notification } from '../../../domain/notification/Notification';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';

describe('FinishPollUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let draftRepository: Partial<DraftRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let boardRepository: Partial<BoardRepository>;
  let userRepository: Partial<UserRepository>;
  let notificationRepository: Partial<NotificationRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let savedNotifications: Notification[];
  let useCase: FinishPollUseCase;
  let poll: Poll;

  beforeEach(() => {
    // Create a test poll
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Test Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2024-01-01'), new Date('2024-12-31'))
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

    // Add a question with answer
    const questionResult = Question.create(
      QuestionText.parse('Question 1'),
      poll.id,
      pollFixtureCreation(QuestionId),
      PageNumber.parse(1),
      SortOrder.parse(1),
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    let question = expectSuccess(questionResult);
    question = Question.reconstitute({
      ...question.toJSON(),
      answers: question.answers,
      id: 'question-1',
    });

    // Add answer
    const answer = expectSuccess(
      Answer.create(
        AnswerText.parse('Answer 1'),
        SortOrder.parse(1),
        question.id,
        testCreation(AnswerId, 'answer-1')
      )
    );
    question.addAnswer(answer);

    poll.addQuestion(question);

    // Take snapshot and activate the poll
    poll.submitToAdmin();
    poll.takeSnapshot();
    poll.activate();

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    draftRepository = {
      deleteAllPollDrafts: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue(
        Organization.reconstitute({
          id: 'org-1',
          name: 'Test Org',
          description: 'desc',
          parentId: null,
          createdById: 'user-1',
          createdAt: new Date(),
          archivedAt: null,
          allowMultiTreeMembership: false,
        })
      ),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    savedNotifications = [];
    notificationRepository = {
      saveBatch: vi.fn().mockImplementation(async (notifs: Notification[]) => {
        savedNotifications.push(...notifs);

        return success(undefined);
      }),
    };

    participantRepository = {
      getParticipants: vi.fn().mockResolvedValue(
        success([
          PollParticipant.reconstitute({
            id: 'p-1',
            pollId: 'poll-1',
            userId: 'user-1',
            userWeight: 1.0,
            willingToSignProtocol: null,
            snapshotAt: new Date(),
            createdAt: new Date(),
          }),
        ])
      ),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    useCase = new FinishPollUseCase(
      pollRepository as PollRepository,
      draftRepository as DraftRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      notificationRepository as NotificationRepository,
      participantRepository as ParticipantRepository,
      boardRepository as BoardRepository,
      pollFixtureIds,
      pollFixtureClock
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
    expect(expectFailure(result)).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is already finished', async () => {
    poll.finish(PollInstant.parse(new Date().toISOString()));

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
  });

  it('should fail if poll is in READY state (not active)', async () => {
    poll.deactivate(); // moves to READY

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
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
      expect(expectFailure(result)).toBe(PollErrors.NOT_AUTHORIZED);
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

  describe('notifications', () => {
    it('preserves finish success and notifications when draft cleanup throws', async () => {
      draftRepository.deleteAllPollDrafts = vi
        .fn()
        .mockRejectedValue(new Error('cleanup unavailable'));
      expect(
        (await useCase.execute({ pollId: poll.id, userId: 'admin-1' })).success
      ).toBe(true);
      expect(savedNotifications).toHaveLength(1);
    });
    it('should notify participants when poll is finished', async () => {
      await useCase.execute({ pollId: poll.id, userId: 'admin-1' });

      expect(savedNotifications).toHaveLength(1);
      expect(savedNotifications[0].type).toBe('poll_finished');
      expect(savedNotifications[0].userId).toBe('user-1');
    });

    it('should not send notifications if finish fails', async () => {
      poll.finish(PollInstant.parse(new Date().toISOString())); // already finished

      await useCase.execute({ pollId: poll.id, userId: 'admin-1' });

      expect(savedNotifications).toHaveLength(0);
    });
  });

  it('should fail if organization is archived', async () => {
    const archivedOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Archived Org',
      description: 'desc',
      parentId: null,
      createdById: 'user-1',
      createdAt: new Date(),
      archivedAt: new Date(),
      allowMultiTreeMembership: false,
    });
    organizationRepository.findById = vi.fn().mockResolvedValue(archivedOrg);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.ORGANIZATION_ARCHIVED);
  });

  it('should fail if board is archived', async () => {
    boardRepository.findById = vi.fn().mockResolvedValue(
      Board.reconstitute({
        id: 'board-1',
        name: 'Archived Board',
        organizationId: 'org-1',
        createdAt: new Date(),
        archivedAt: new Date(),
      })
    );

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.BOARD_ARCHIVED);
  });
});
