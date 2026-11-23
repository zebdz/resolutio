import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
/** Poll use-case compatibility: explicit creation fixtures and repository ports
 * preserve authorization, eligibility and expected user-visible outcomes. */
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { testCreation } from '@/domain/shared/__tests__/creation';
import {
  PollId,
  QuestionId,
  AnswerId,
  ParticipantId,
  VoteId,
  VoteDraftId,
  UserId,
  BoardId,
  OrganizationId,
} from '@/domain/shared/EntityIds';
import { createQuestionIds, questionClock } from './questionTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitDraftUseCase } from '../SubmitDraftUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { DraftRepository } from '../../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { Board } from '../../../domain/board/Board';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { Decimal } from 'decimal.js';

const confirmedUser = { isConfirmed: () => true } as unknown as User;
const unconfirmedUser = { isConfirmed: () => false } as unknown as User;

describe('SubmitDraftUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let draftRepository: Partial<DraftRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let boardRepository: Partial<BoardRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: SubmitDraftUseCase;
  let poll: Poll;
  let question: Question;
  let answer: Answer;
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

    // Create a question
    const questionResult = Question.create(
      QuestionText.parse('Test Question'),
      poll.id,
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(0),
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    question = expectSuccess(questionResult);

    // Create an answer and add to question
    const answerResult = Answer.create(
      AnswerText.parse('Test Answer'),
      SortOrder.parse(1),
      question.id,
      testCreation(AnswerId, 'answer-1')
    );
    expect(answerResult.success).toBe(true);
    answer = expectSuccess(answerResult);
    question.addAnswer(answer);

    // Add questions to poll and activate
    poll = Poll.reconstitute({ ...poll.toJSON(), questions: [question] });
    poll.submitToAdmin();
    poll.takeSnapshot();
    poll.activate();

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
      saveDraft: vi.fn().mockImplementation((draft) => success(draft)),
      deleteDraftsByQuestion: vi.fn().mockResolvedValue(success(undefined)),
      deleteDraftByAnswer: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
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

    boardRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    userRepository = {
      findById: vi.fn().mockResolvedValue(confirmedUser),
    };

    useCase = new SubmitDraftUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      draftRepository as DraftRepository,
      organizationRepository as OrganizationRepository,
      boardRepository as BoardRepository,
      userRepository as UserRepository,
      createQuestionIds(),
      questionClock
    );
  });

  it('should successfully save a draft', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: 'non-existent',
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should reject when poll not active', async () => {
    // Create inactive poll
    const inactivePollResult = Poll.create(
      PollTitle.parse('Inactive Poll'),
      PollDescription.parse('Test Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-admin'),
      expectSuccess(
        PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(inactivePollResult.success).toBe(true);
    const inactivePoll = expectSuccess(inactivePollResult);

    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(inactivePoll));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: inactivePoll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
    }
  });

  it('should reject when poll is finished', async () => {
    poll.finish(PollInstant.parse(new Date().toISOString()));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_FINISHED);
    }
  });

  it('should reject when user is not a participant', async () => {
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));

    const result = await useCase.execute({
      userId: 'non-participant',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.NOT_PARTICIPANT);
    }
  });

  it('should reject when user has already voted', async () => {
    voteRepository.hasUserFinishedVoting = vi
      .fn()
      .mockResolvedValue(success(true));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
    }
  });

  it('should delete existing drafts for single-choice questions', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftsByQuestion).toHaveBeenCalledWith(
      poll.id,
      question.id,
      'user-1'
    );
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should allow multiple drafts for multiple-choice questions', async () => {
    question.updateType('multiple-choice');
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: false,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftsByQuestion).not.toHaveBeenCalled();
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should allow unselecting (removing) a draft for multiple-choice questions', async () => {
    question.updateType('multiple-choice');
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: false,
      shouldRemove: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftByAnswer).toHaveBeenCalledWith(
      poll.id,
      question.id,
      answer.id,
      'user-1'
    );
  });

  it('should fail if organization is archived', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived Org',
        description: 'desc',
        parentId: null,
        createdById: 'user-1',
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
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
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.BOARD_ARCHIVED);
  });
  describe('open polls', () => {
    let openPoll: Poll;

    beforeEach(() => {
      openPoll = expectSuccess(
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
      openPoll = Poll.reconstitute({
        ...openPoll.toJSON(),
        questions: [question],
      });
      openPoll.submitToAdmin();
      openPoll.takeSnapshot();
      openPoll.activate();

      pollRepository.getPollById = vi
        .fn()
        .mockImplementation(async () => success(openPoll));
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(null));
    });

    it('lets a confirmed non-participant save a draft', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        questionId: question.id,
        answerId: answer.id,
        userId: 'outsider-1',
        isSingleChoice: true,
      });

      expect(result.success).toBe(true);
      expect(draftRepository.saveDraft).toHaveBeenCalled();
    });

    it('does not query the participant repository', async () => {
      await useCase.execute({
        pollId: 'poll-1',
        questionId: question.id,
        answerId: answer.id,
        userId: 'outsider-1',
        isSingleChoice: true,
      });

      expect(
        participantRepository.getParticipantByUserAndPoll
      ).not.toHaveBeenCalled();
    });

    it('rejects an unconfirmed user', async () => {
      userRepository.findById = vi.fn().mockResolvedValue(unconfirmedUser);

      const result = await useCase.execute({
        pollId: 'poll-1',
        questionId: question.id,
        answerId: answer.id,
        userId: 'outsider-1',
        isSingleChoice: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.USER_NOT_CONFIRMED);
    });

    it('rejects a user who already finished voting', async () => {
      voteRepository.hasUserFinishedVoting = vi
        .fn()
        .mockResolvedValue(success(true));

      const result = await useCase.execute({
        pollId: 'poll-1',
        questionId: question.id,
        answerId: answer.id,
        userId: 'outsider-1',
        isSingleChoice: true,
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollDomainCodes.ALREADY_VOTED);
    });
  });
});
