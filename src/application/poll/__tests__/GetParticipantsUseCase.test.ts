import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
/** Poll use-case compatibility: explicit creation fixtures and repository ports
 * preserve authorization, eligibility and expected user-visible outcomes. */
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import {
  expectSuccess,
  expectFailure,
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
import { GetParticipantsUseCase } from '../GetParticipantsUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { OrganizationErrors } from '../../organization/OrganizationErrors';
import { Decimal } from 'decimal.js';

describe('GetParticipantsUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let prisma: any;
  let useCase: GetParticipantsUseCase;
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
    poll = expectSuccess(pollResult);

    // Add question with answer so poll can transition to READY state
    const questionResult = Question.create(
      QuestionText.parse('Test Q'),
      PollId.parse('poll-1'),
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    const answerResult = Answer.create(
      AnswerText.parse('Test A'),
      SortOrder.parse(1),
      expectSuccess(questionResult).id,
      testCreation(AnswerId, 'answer-1')
    );
    expectSuccess(questionResult).addAnswer(expectSuccess(answerResult));
    poll.addQuestion(expectSuccess(questionResult));
    poll.submitToAdmin();
    poll.takeSnapshot();
    // Poll is now in READY state (canModify should be true if no votes)

    // Create participant
    const participantResult = PollParticipant.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      testCreation(ParticipantId, 'participant-1'),
      VotingWeight.parse(new Decimal(1.5).toNumber())
    );
    expect(participantResult.success).toBe(true);
    participant = expectSuccess(participantResult);

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
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

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
        }),
      },
    };

    userRepository.findById = vi.fn(async (id) =>
      prisma.user.findUnique({ where: { id } })
    );

    useCase = new GetParticipantsUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository
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

    if (pollWithoutSnapshot.success) {
      pollWithoutSnapshot.value = Poll.reconstitute({
        ...pollWithoutSnapshot.value.toJSON(),
        questions: pollWithoutSnapshot.value.questions,
        id: 'poll-2',
      });
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

  describe('superadmin authorization', () => {
    it('should allow superadmin (not org admin) to get participants', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.participants.length).toBe(1);
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
