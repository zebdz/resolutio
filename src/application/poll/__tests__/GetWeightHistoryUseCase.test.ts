import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetWeightHistoryUseCase } from '../GetWeightHistoryUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Board } from '../../../domain/board/Board';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { Decimal } from 'decimal.js';

describe('GetWeightHistoryUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let boardRepository: Partial<BoardRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let prisma: any;
  let useCase: GetWeightHistoryUseCase;
  let poll: Poll;
  let board: Board;
  let participant: PollParticipant;
  let historyEntry: ParticipantWeightHistory;

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

    // Create history entry
    const historyResult = ParticipantWeightHistory.create(
      'participant-1',
      'poll-1',
      'user-1',
      1.0,
      2.0,
      'user-admin',
      'Weight adjustment'
    );
    expect(historyResult.success).toBe(true);
    if (historyResult.success) {
      historyEntry = historyResult.value;
      (historyEntry as any).props.id = 'history-1';
    }

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipantById: vi.fn().mockResolvedValue(success(participant)),
      getWeightHistory: vi.fn().mockResolvedValue(success([historyEntry])),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(board),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
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

    useCase = new GetWeightHistoryUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      boardRepository as BoardRepository,
      organizationRepository as OrganizationRepository,
      prisma
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

  it('should reject when board not found', async () => {
    boardRepository.findById = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({
      pollId: 'poll-1',
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
      'participant-1',
      'poll-1',
      'user-1',
      2.0,
      3.0,
      'user-admin',
      'Another adjustment'
    );
    expect(history2Result.success).toBe(true);
    if (history2Result.success) {
      const history2 = history2Result.value;
      (history2 as any).props.id = 'history-2';
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
});
