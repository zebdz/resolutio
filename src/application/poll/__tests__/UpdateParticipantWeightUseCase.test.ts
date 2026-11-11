import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { VotingWeight } from '@/domain/poll/VotingWeight';
/** Poll use-case compatibility: explicit creation fixtures and repository ports
 * preserve authorization, eligibility and expected user-visible outcomes. */
import {
  expectFailure,
  expectSuccess,
} from '@/domain/shared/__tests__/resultAssertions';
import { createQuestionIds, questionClock } from './questionTestValues';
import { testCreation } from '@/domain/shared/__tests__/creation';
import {
  PollId,
  QuestionId,
  AnswerId,
  ParticipantId,
  ParticipantWeightHistoryId,
  VoteId,
  VoteDraftId,
  UserId,
  OrganizationId,
  BoardId,
} from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateParticipantWeightUseCase } from '../UpdateParticipantWeightUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Board } from '../../../domain/board/Board';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Decimal } from 'decimal.js';

describe('UpdateParticipantWeightUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let boardRepository: Partial<BoardRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: UpdateParticipantWeightUseCase;
  let poll: Poll;
  let participant: PollParticipant;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Test Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-admin'),
      expectSuccess(
        PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);

    if (pollResult.success) {
      poll = pollResult.value;

      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();
    }

    // Create participant
    const participantResult = PollParticipant.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      testCreation(ParticipantId, 'participant-1'),
      VotingWeight.parse(new Decimal(1.0).toNumber())
    );
    expect(participantResult.success).toBe(true);

    if (participantResult.success) {
      participant = participantResult.value;
    }

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    participantRepository = {
      getParticipantById: vi.fn().mockResolvedValue(success(participant)),
      updateParticipantWeight: vi.fn().mockResolvedValue(success(undefined)),
      createWeightHistory: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue(
        Organization.reconstitute({
          id: 'org-1',
          name: 'Test Org',
          description: 'desc',
          parentId: null,
          createdById: 'user-admin',
          createdAt: new Date(),
          archivedAt: null,
          allowMultiTreeMembership: false,
        })
      ),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new UpdateParticipantWeightUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      boardRepository as BoardRepository,
      createQuestionIds(),
      questionClock
    );
  });

  it('should successfully update participant weight', async () => {
    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
      reason: 'Weight adjustment',
    });

    expect(result.success).toBe(true);
    expect(participantRepository.updateParticipantWeight).toHaveBeenCalled();
    expect(participantRepository.updateParticipantWeight).toHaveBeenCalled();
  });

  it('should reject negative weight', async () => {
    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: -1,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.INVALID_WEIGHT);
    }
  });

  it('should reject when participant not found', async () => {
    participantRepository.getParticipantById = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      participantId: 'non-existent',
      newWeight: 2.5,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('poll.errors.participantNotFound');
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should reject when user is not admin', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-non-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should reject when poll has votes', async () => {
    voteRepository.pollHasVotes = vi.fn().mockResolvedValue(success(true));

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES
      );
    }
  });

  it('should create weight history with reason', async () => {
    await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
      reason: 'Property size increased',
    });

    expect(participantRepository.updateParticipantWeight).toHaveBeenCalled();
    const historyCall = (participantRepository.updateParticipantWeight as any)
      .mock.calls[0][1];
    expect(historyCall.reason).toBe('Property size increased');
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not org admin) to update weight', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        participantId: 'participant-1',
        newWeight: 2.5,
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);
      expect(participantRepository.updateParticipantWeight).toHaveBeenCalled();
    });

    it('should reject non-admin non-superadmin', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

      const result = await useCase.execute({
        participantId: 'participant-1',
        newWeight: 2.5,
        adminUserId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(OrganizationErrors.NOT_ADMIN);
    });
  });

  it('should fail if organization is archived', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived Org',
        description: 'desc',
        parentId: null,
        createdById: 'user-admin',
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
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
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.BOARD_ARCHIVED);
  });

  function makeOpenPoll(): Poll {
    let openPoll = expectSuccess(
      Poll.create(
        PollTitle.parse('Open Poll'),
        PollDescription.parse('Everyone may vote'),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-admin'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1'),
        undefined,
        'OPEN'
      )
    );
    openPoll = Poll.reconstitute({
      ...openPoll.toJSON(),
      questions: openPoll.questions,
      id: 'poll-1',
    });

    return openPoll;
  }

  it('rejects a weight change on an open poll', async () => {
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(makeOpenPoll()));

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 5,
      adminUserId: 'user-admin',
      reason: 'because',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.OPEN_PARTICIPANTS_IMMUTABLE);
  });
});
