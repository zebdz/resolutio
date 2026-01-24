import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateParticipantWeightUseCase } from '../UpdateParticipantWeightUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Board } from '../../../domain/board/Board';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Decimal } from 'decimal.js';

describe('UpdateParticipantWeightUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let boardRepository: Partial<BoardRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let useCase: UpdateParticipantWeightUseCase;
  let poll: Poll;
  let board: Board;
  let participant: PollParticipant;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'board-1',
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);
    if (pollResult.success) {
      poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      poll.activate();
      poll.takeParticipantsSnapshot();
    }

    // Create board
    const boardResult = Board.create('org-1', 'Test Board', 'user-admin');
    expect(boardResult.success).toBe(true);
    if (boardResult.success) {
      board = boardResult.value;
      (board as any).props.id = 'board-1';
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
      updateParticipantWeight: vi.fn().mockResolvedValue(success(undefined)),
      createWeightHistory: vi.fn().mockResolvedValue(success(undefined)),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(board),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
    };

    useCase = new UpdateParticipantWeightUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      boardRepository as BoardRepository,
      organizationRepository as OrganizationRepository
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
    expect(participantRepository.createWeightHistory).toHaveBeenCalled();
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

  it('should reject when board not found', async () => {
    boardRepository.findById = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({
      participantId: 'participant-1',
      newWeight: 2.5,
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.BOARD_NOT_FOUND);
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

    expect(participantRepository.createWeightHistory).toHaveBeenCalled();
    const historyCall = (participantRepository.createWeightHistory as any).mock
      .calls[0][0];
    expect(historyCall.reason).toBe('Property size increased');
  });
});
