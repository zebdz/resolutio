import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetParticipantsUseCase } from '../GetParticipantsUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { Decimal } from 'decimal.js';

describe('GetParticipantsUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let prisma: any;
  let useCase: GetParticipantsUseCase;
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
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Add question with answer so poll can transition to READY state
    const questionResult = Question.create(
      'Test Q',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    const answerResult = Answer.create('Test A', 1, questionResult.value.id);
    questionResult.value.addAnswer(answerResult.value);
    poll.addQuestion(questionResult.value);
    poll.takeSnapshot();
    // Poll is now in READY state (canModify should be true if no votes)

    // Create participant
    const participantResult = PollParticipant.create(
      'poll-1',
      'user-1',
      new Decimal(1.5).toNumber()
    );
    expect(participantResult.success).toBe(true);
    participant = participantResult.value;
    (participant as any).props.id = 'participant-1';

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipants: vi.fn().mockResolvedValue(success([participant])),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
    };

    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+1234567890',
        }),
      },
    };

    useCase = new GetParticipantsUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      organizationRepository as OrganizationRepository,
      prisma
    );
  });

  it('should return participants with user details', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.participants.length).toBe(1);
      expect(result.value.participants[0].user.id).toBe('user-1');
      expect(result.value.participants[0].user.firstName).toBe('John');
      expect(result.value.canModify).toBe(true);
    }
  });

  it('should indicate canModify=false when votes exist', async () => {
    voteRepository.pollHasVotes = vi.fn().mockResolvedValue(success(true));

    const result = await useCase.execute({
      pollId: 'poll-1',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canModify).toBe(false);
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'poll-1',
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

  it('should indicate canModify=false when snapshot not taken', async () => {
    // Create poll without snapshot
    const pollWithoutSnapshot = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );

    if (pollWithoutSnapshot.success) {
      (pollWithoutSnapshot.value as any).props.id = 'poll-2';
      pollWithoutSnapshot.value.activate();
      pollRepository.getPollById = vi
        .fn()
        .mockResolvedValue(success(pollWithoutSnapshot.value));
    }

    const result = await useCase.execute({
      pollId: 'poll-2',
      adminUserId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canModify).toBe(false);
    }
  });
});
