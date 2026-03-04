import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscardSnapshotUseCase } from '../DiscardSnapshotUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

describe('DiscardSnapshotUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let boardRepository: Partial<BoardRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: DiscardSnapshotUseCase;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll in READY state
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    const questionResult = Question.create(
      'Question 1',
      poll.id,
      1,
      1,
      'single-choice'
    );
    const question = questionResult.value;
    (question as any).props.id = 'question-1';
    const answerResult = Answer.create('Answer 1', 1, question.id);
    question.addAnswer(answerResult.value);
    poll.addQuestion(question);
    poll.takeSnapshot();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
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
        })
      ),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    voteRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
    };

    participantRepository = {
      deleteParticipantsByPollId: vi
        .fn()
        .mockResolvedValue(success(undefined)),
    };

    useCase = new DiscardSnapshotUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
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

    expect(result.success).toBe(true);
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
      })
    );

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.ORGANIZATION_ARCHIVED);
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

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.BOARD_ARCHIVED);
  });

  it('should fail if poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if user is not authorized', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'regular-user',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
  });
});
