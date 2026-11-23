/** Poll use-case compatibility: explicit creation fixtures and repository ports
 * preserve authorization, eligibility and expected user-visible outcomes. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
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
import { GetUserVotingProgressUseCase } from '../GetUserVotingProgressUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { DraftRepository } from '../../../domain/poll/DraftRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { Answer } from '../../../domain/poll/Answer';
import { Decimal } from 'decimal.js';
import { PollState } from '../../../domain/poll/PollState';
import { UserRepository } from '../../../domain/user/UserRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { User } from '../../../domain/user/User';

const confirmedUser = { isConfirmed: () => true } as unknown as User;
const unconfirmedUser = { isConfirmed: () => false } as unknown as User;

describe('GetUserVotingProgressUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let draftRepository: Partial<DraftRepository>;
  let userRepository: Partial<UserRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let useCase: GetUserVotingProgressUseCase;
  let poll: Poll;
  let question1: Question;
  let question2: Question;
  let answer1: Answer;
  let answer2: Answer;
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

    // Create two questions
    const question1Result = Question.create(
      QuestionText.parse('Question 1'),
      poll.id,
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    expect(question1Result.success).toBe(true);
    question1 = expectSuccess(question1Result);

    const question2Result = Question.create(
      QuestionText.parse('Question 2'),
      poll.id,
      testCreation(QuestionId, 'question-2'),
      PageNumber.parse(1),
      SortOrder.parse(1),
      'single-choice'
    );
    expect(question2Result.success).toBe(true);
    question2 = expectSuccess(question2Result);

    // Create answers
    const answer1Result = Answer.create(
      AnswerText.parse('Answer 1'),
      SortOrder.parse(1),
      question1.id,
      testCreation(AnswerId, 'answer-1')
    );
    expect(answer1Result.success).toBe(true);
    answer1 = expectSuccess(answer1Result);

    const answer2Result = Answer.create(
      AnswerText.parse('Answer 2'),
      SortOrder.parse(1),
      question2.id,
      testCreation(AnswerId, 'answer-2')
    );
    expect(answer2Result.success).toBe(true);
    answer2 = expectSuccess(answer2Result);

    // Reconstitute poll with questions (in ACTIVE state)
    poll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      organizationId: poll.organizationId,
      boardId: poll.boardId,
      pollType: poll.pollType,
      startDate: poll.startDate,
      endDate: poll.endDate,
      state: PollState.ACTIVE,
      weightCriteria: poll.weightCriteria,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      propertyIds: [],
      anonymous: false,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: [question1, question2],
    });

    // Create a participant
    const participantResult = PollParticipant.create(
      poll.id,
      UserId.parse('user-1'),
      testCreation(ParticipantId, 'participant-1'),
      VotingWeight.parse(new Decimal(1.0).toNumber())
    );
    expect(participantResult.success).toBe(true);
    participant = expectSuccess(participantResult);

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    participantRepository = {
      getParticipantByUserAndPoll: vi
        .fn()
        .mockResolvedValue(success(participant)),
    };

    voteRepository = {
      hasUserFinishedVoting: vi.fn().mockResolvedValue(success(false)),
    };

    draftRepository = {
      getUserDrafts: vi.fn().mockResolvedValue(success([])),
    };

    userRepository = {
      findById: vi.fn().mockResolvedValue(confirmedUser),
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };
    organizationRepository = {
      isUserMember: vi.fn().mockResolvedValue(true),
      isUserAdmin: vi.fn().mockResolvedValue(false),
    };

    useCase = new GetUserVotingProgressUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      draftRepository as DraftRepository,
      userRepository as UserRepository,
      organizationRepository as OrganizationRepository
    );
  });

  it('should return voting progress with no drafts', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.poll.id).toBe(poll.id);
      expect(progress.drafts.length).toBe(0);
      expect(progress.hasFinished).toBe(false);
      expect(progress.canVote).toBe(true);
      expect(progress.answeredQuestionIds.length).toBe(0);
      expect(progress.totalQuestions).toBe(2);
    }
  });

  it('denies an organization outsider before loading private voting progress', async () => {
    vi.mocked(
      participantRepository.getParticipantByUserAndPoll!
    ).mockResolvedValue(success(null));
    vi.mocked(organizationRepository.isUserMember!).mockResolvedValue(false);
    const result = await useCase.execute({
      userId: 'outsider',
      pollId: poll.id,
    });
    expect(result).toEqual({
      success: false,
      error: PollErrors.NOT_ORG_MEMBER,
    });
    expect(draftRepository.getUserDrafts).not.toHaveBeenCalled();
    expect(voteRepository.hasUserFinishedVoting).not.toHaveBeenCalled();
  });

  it.each(['organization', 'superadmin'])(
    'allows %s administrators without membership',
    async (role) => {
      vi.mocked(organizationRepository.isUserMember!).mockResolvedValue(false);
      vi.mocked(organizationRepository.isUserAdmin!).mockResolvedValue(
        role === 'organization'
      );
      vi.mocked(userRepository.isSuperAdmin!).mockResolvedValue(
        role === 'superadmin'
      );
      const result = await useCase.execute({
        userId: 'admin',
        pollId: poll.id,
      });
      expect(result.success).toBe(true);
    }
  );

  it('should return voting progress with drafts', async () => {
    // Create draft
    const draftResult = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      UserId.parse('user-1'),
      testCreation(VoteDraftId, 'draft-1')
    );
    expect(draftResult.success).toBe(true);
    draftRepository.getUserDrafts = vi
      .fn()
      .mockResolvedValue(success([expectSuccess(draftResult)]));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.drafts.length).toBe(1);
      expect(progress.answeredQuestionIds).toContain(question1.id);
      expect(progress.answeredQuestionIds.length).toBe(1);
      expect(progress.canVote).toBe(true);
    }
  });

  it('should indicate user has finished when votes exist', async () => {
    voteRepository.hasUserFinishedVoting = vi
      .fn()
      .mockResolvedValue(success(true));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.hasFinished).toBe(true);
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when poll is not active', async () => {
    // Create poll in READY state (not active)
    const inactivePoll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      organizationId: poll.organizationId,
      boardId: poll.boardId,
      pollType: poll.pollType,
      startDate: poll.startDate,
      endDate: poll.endDate,
      state: PollState.READY,
      weightCriteria: poll.weightCriteria,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      propertyIds: [],
      anonymous: false,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: [question1, question2],
    });
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(inactivePoll));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when poll is finished', async () => {
    // Create finished poll
    const finishedPoll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      organizationId: poll.organizationId,
      boardId: poll.boardId,
      pollType: poll.pollType,
      startDate: poll.startDate,
      endDate: poll.endDate,
      state: PollState.FINISHED,
      weightCriteria: poll.weightCriteria,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      propertyIds: [],
      anonymous: false,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: [question1, question2],
    });
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(finishedPoll));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when not a participant', async () => {
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      userId: 'non-participant',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: 'non-existent',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should exclude archived questions from total count', async () => {
    // Archive first question
    question1.archive(questionClock.now());

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      expect(progress.totalQuestions).toBe(1); // Only non-archived question
    }
  });

  it('should handle multiple drafts for same question', async () => {
    // Create two drafts for same question
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      AnswerId.parse('answer-1'),
      UserId.parse('user-1'),
      testCreation(VoteDraftId, 'draft-2')
    );
    const draft2Result = VoteDraft.create(
      poll.id,
      question1.id,
      AnswerId.parse('answer-2'),
      UserId.parse('user-1'),
      testCreation(VoteDraftId, 'draft-3')
    );
    expect(draft1Result.success && draft2Result.success).toBe(true);
    draftRepository.getUserDrafts = vi
      .fn()
      .mockResolvedValue(
        success([expectSuccess(draft1Result), expectSuccess(draft2Result)])
      );

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const progress = result.value;
      // Should count question only once even with multiple drafts
      expect(
        progress.answeredQuestionIds.filter((id) => id === question1.id).length
      ).toBe(1);
      expect(progress.drafts.length).toBe(2);
    }
  });
  describe('open polls', () => {
    let openPoll: Poll;

    beforeEach(() => {
      openPoll = Poll.reconstitute({
        id: 'poll-1',
        title: 'Open Poll',
        description: 'Everyone may vote',
        organizationId: 'org-1',
        boardId: null,
        pollType: 'OPEN',
        startDate: poll.startDate,
        endDate: poll.endDate,
        state: PollState.ACTIVE,
        weightCriteria: null,
        distributionType: 'EQUAL',
        propertyAggregation: 'RAW_SUM',
        propertyIds: [],
        anonymous: false,
        createdBy: poll.createdBy,
        createdAt: poll.createdAt,
        archivedAt: null,
        questions: [question1, question2],
      });

      pollRepository.getPollById = vi
        .fn()
        .mockImplementation(async () => success(openPoll));
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(null));
    });

    it('canVote is true for a confirmed non-participant', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(true);
      expect(expectSuccess(result).canVote).toBe(true);
    });

    it('canVote is false for an unconfirmed user', async () => {
      userRepository.findById = vi.fn().mockResolvedValue(unconfirmedUser);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(true);
      expect(expectSuccess(result).canVote).toBe(false);
    });

    it('canVote is false once the user has finished voting', async () => {
      voteRepository.hasUserFinishedVoting = vi
        .fn()
        .mockResolvedValue(success(true));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(true);
      expect(expectSuccess(result).canVote).toBe(false);
      expect(expectSuccess(result).hasFinished).toBe(true);
    });
  });
});
