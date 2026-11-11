/** Poll use-case compatibility: explicit creation fixtures and repository ports
 * preserve authorization, eligibility and expected user-visible outcomes. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { expectFailure } from '@/domain/shared/__tests__/resultAssertions';
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
import { GetWeightHistoryUseCase } from '../GetWeightHistoryUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { Decimal } from 'decimal.js';

describe('GetWeightHistoryUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let prisma: any;
  let useCase: GetWeightHistoryUseCase;
  let poll: Poll;
  let participant: PollParticipant;
  let historyEntry: ParticipantWeightHistory;

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

    // Create history entry
    const historyResult = ParticipantWeightHistory.create(
      ParticipantId.parse('participant-1'),
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      VotingWeight.parse(1.0),
      VotingWeight.parse(2.0),
      UserId.parse('user-admin'),
      testCreation(ParticipantWeightHistoryId, 'history-1'),
      'Weight adjustment'
    );
    expect(historyResult.success).toBe(true);

    if (historyResult.success) {
      historyEntry = historyResult.value;
    }

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    participantRepository = {
      getParticipantById: vi.fn().mockResolvedValue(success(participant)),
      getWeightHistory: vi.fn().mockResolvedValue(success([historyEntry])),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    prisma = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-admin') {
            return Promise.resolve({
              id: 'user-admin',
              firstName: 'Admin',
              lastName: 'User',
              phoneNumber: '+1234567890',
            });
          }

          if (where.id === 'user-1') {
            return Promise.resolve({
              id: 'user-1',
              firstName: 'John',
              lastName: 'Doe',
              phoneNumber: '+0987654321',
            });
          }

          return Promise.resolve(null);
        }),
      },
    };

    userRepository.findById = vi.fn(async (id) =>
      prisma.user.findUnique({ where: { id } })
    );

    useCase = new GetWeightHistoryUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository
    );
  });

  it('should return weight history with user details', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.history.length).toBe(1);
      expect(result.value.history[0].history.id).toBe('history-1');
      expect(result.value.history[0].changedByUser.firstName).toBe('Admin');
      expect(result.value.history[0].participantUser.firstName).toBe('John');
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
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
      pollId: 'poll-1',
      adminUserId: 'user-non-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should return empty array when no history exists', async () => {
    participantRepository.getWeightHistory = vi
      .fn()
      .mockResolvedValue(success([]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.history.length).toBe(0);
    }
  });

  it('should handle multiple history entries', async () => {
    const history2Result = ParticipantWeightHistory.create(
      ParticipantId.parse('participant-1'),
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      VotingWeight.parse(2.0),
      VotingWeight.parse(3.0),
      UserId.parse('user-admin'),
      testCreation(ParticipantWeightHistoryId, 'history-2'),
      'Another adjustment'
    );
    expect(history2Result.success).toBe(true);

    if (history2Result.success) {
      const history2 = history2Result.value;
      participantRepository.getWeightHistory = vi
        .fn()
        .mockResolvedValue(success([historyEntry, history2]));
    }

    const result = await useCase.execute({
      pollId: 'poll-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.history.length).toBe(2);
    }
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not org admin) to get weight history', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.history.length).toBe(1);
      }
    });

    it('should reject non-admin non-superadmin', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

      const result = await useCase.execute({
        pollId: 'poll-1',
        adminUserId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(OrganizationErrors.NOT_ADMIN);
    });
  });
});
