import { PollPeriod } from '@/domain/poll/PollPeriod';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { UserId } from '@/domain/shared/EntityIds';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
/** Exercises snapshot discard through the application boundary, including
 * domain decisions against the freshly locked poll rather than the authorization read. */
import { testCreation } from '@/domain/shared/__tests__/creation';
import { QuestionId, AnswerId, PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscardSnapshotUseCase } from '../DiscardSnapshotUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { PollSnapshotTransaction } from '../PollSnapshotTransaction';
import { PollState } from '../../../domain/poll/PollState';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('DiscardSnapshotUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let snapshotTransaction: PollSnapshotTransaction;
  let persistedState: PollState;
  let participantIds: string[];
  let lockedPoll: Poll;
  let hasVotes: boolean;
  let organizationRepository: Partial<OrganizationRepository>;
  let boardRepository: Partial<BoardRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: DiscardSnapshotUseCase;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll in READY state
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Test Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('admin-1'),
      expectSuccess(
        PollPeriod.create(new Date('2024-01-01'), new Date('2024-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    poll = Poll.reconstitute({
      ...unwrap(pollResult).toJSON(),
      id: 'poll-1',
      questions: [],
    });

    const questionResult = Question.create(
      QuestionText.parse('Question 1'),
      poll.id,
      pollFixtureCreation(QuestionId),
      PageNumber.parse(1),
      SortOrder.parse(1),
      'single-choice'
    );
    const question = Question.reconstitute({
      ...unwrap(questionResult).toJSON(),
      id: 'question-1',
      answers: [],
    });
    const answerResult = Answer.create(
      AnswerText.parse('Answer 1'),
      SortOrder.parse(1),
      question.id,
      pollFixtureCreation(AnswerId)
    );
    question.addAnswer(unwrap(answerResult));
    poll.addQuestion(question);
    poll.submitToAdmin();
    poll.takeSnapshot();

    pollRepository = {
      getPollById: vi.fn().mockImplementation(async () => success(poll)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      findById: vi.fn().mockResolvedValue(
        Organization.reconstitute({
          id: 'org-1',
          name: 'Test Org',
          description: 'desc',
          parentId: null,
          createdById: 'admin-1',
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

    lockedPoll = poll;
    hasVotes = false;
    persistedState = PollState.READY;
    participantIds = ['participant-1'];
    snapshotTransaction = {
      withLockedPoll: async (_pollId, work) =>
        work({
          poll: lockedPoll,
          hasVotes: async () => hasVotes,
          savePoll: async () => {
            persistedState = lockedPoll.state;
          },
          removeParticipantSnapshot: async () => {
            participantIds = [];
          },
        }),
    };

    useCase = new DiscardSnapshotUseCase(
      pollRepository as PollRepository,
      snapshotTransaction,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      boardRepository as BoardRepository
    );
  });

  it('should discard snapshot successfully', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result).toEqual(success(undefined));
    expect(persistedState).toBe(PollState.SUBMITTED);
    expect(participantIds).toEqual([]);
  });

  it('rejects votes observed under the lock without changing the snapshot', async () => {
    hasVotes = true;

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result).toEqual(
      failure(PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES)
    );
    expect(persistedState).toBe(PollState.READY);
    expect(participantIds).toEqual(['participant-1']);
  });

  it('rejects a poll activated after the initial authorization read', async () => {
    // Keep the earlier READY object as the authorization read; the lock sees ACTIVE.
    const earlierPoll = poll;
    lockedPoll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
    });
    unwrap(lockedPoll.activate());
    persistedState = PollState.ACTIVE;

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(earlierPoll.state).toBe(PollState.READY);
    expect(result).toEqual(failure(PollDomainCodes.POLL_MUST_BE_READY));
    expect(persistedState).toBe(PollState.ACTIVE);
    expect(participantIds).toEqual(['participant-1']);
  });

  it('should fail if organization is archived', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived Org',
        description: 'desc',
        parentId: null,
        createdById: 'admin-1',
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result).toEqual(failure(PollErrors.ORGANIZATION_ARCHIVED));
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
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result).toEqual(failure(PollErrors.BOARD_ARCHIVED));
  });

  it('should fail if poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result).toEqual(failure(PollErrors.NOT_FOUND));
  });

  it('should fail if user is not authorized', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'regular-user',
    });

    expect(result).toEqual(failure(PollErrors.NOT_AUTHORIZED));
  });
});

function unwrap<T>(result: Result<T, string>): T {
  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}
