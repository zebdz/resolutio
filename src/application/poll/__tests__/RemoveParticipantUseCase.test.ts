import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RemoveParticipantUseCase } from '../RemoveParticipantUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Decimal } from 'decimal.js';

describe('RemoveParticipantUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let useCase: RemoveParticipantUseCase;
  let poll: Poll;
  let participant: PollParticipant;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);

    if (pollResult.success) {
      poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      poll.takeSnapshot();
      poll.activate();
    }

    // Create participant
    const participantResult = PollParticipant.create(
      'poll-1',
      'user-1',
      new Decimal(1.0).toNumber()
    );
    expect(participantResult.success).toBe(true);

    if (participantResult.success) {
      participant = participantResult.value;
      (participant as any).props.id = 'participant-1';
    }

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipantById: vi.fn().mockResolvedValue(success(participant)),
      deleteParticipant: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
    };

    useCase = new RemoveParticipantUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      organizationRepository as OrganizationRepository
    );
  });

  it('should successfully remove participant', async () => {
    const result = await useCase.execute({
      participantId: 'participant-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);
    expect(participantRepository.deleteParticipant).toHaveBeenCalledWith(
      'participant-1'
    );
  });

  it('should reject when participant not found', async () => {
    participantRepository.getParticipantById = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      participantId: 'non-existent',
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
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES
      );
    }
  });
});
