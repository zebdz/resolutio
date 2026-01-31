import { describe, it, expect, beforeEach } from 'vitest';
import { ActivatePollUseCase } from '../ActivatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Board } from '../../../domain/board/Board';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Vote } from '../../../domain/poll/Vote';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { PollState } from '../../../domain/poll/PollState';

class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    this.polls.set(poll.id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(false);
  }

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    return success(null);
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    return success([]);
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    return success(undefined);
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    return success(answer);
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    return success(null);
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    return success([]);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    return success(vote);
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    return success(false);
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    return success(draft);
  }

  async getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    return success([]);
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteDraftByAnswer(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }
}

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return [];
  }

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    return null;
  }

  async findBoardMembers(boardId: string): Promise<{ userId: string }[]> {
    return [];
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    return false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void> {}

  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {}

  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
}

class MockOrganizationRepository implements OrganizationRepository {
  private admins: Set<string> = new Set();

  setAdmin(userId: string, organizationId: string): void {
    this.admins.add(`${organizationId}:${userId}`);
  }

  async save(organization: any): Promise<any> {
    return organization;
  }

  async findById(id: string): Promise<any> {
    return null;
  }

  async findByName(name: string): Promise<any> {
    return null;
  }

  async findByCreatorId(creatorId: string): Promise<any[]> {
    return [];
  }

  async findByParentId(parentId: string): Promise<any[]> {
    return [];
  }

  async getAncestorIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    return false;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    return this.admins.has(`${organizationId}:${userId}`);
  }

  async findMembershipsByUserId(userId: string): Promise<any[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(userId: string): Promise<any[]> {
    return [];
  }

  async findAllWithStats(excludeUserMemberships?: string): Promise<any[]> {
    return [];
  }

  async update(organization: any): Promise<any> {
    return organization;
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  setSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async findById(id: string): Promise<User | null> {
    return null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    return [];
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    return null;
  }

  async save(user: User): Promise<User> {
    return user;
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    return false;
  }

  async searchUsers(query: string): Promise<User[]> {
    return [];
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
}

// Helper to create a poll in READY state
function createReadyPoll(id: string, boardId: string, createdBy: string): Poll {
  const pollResult = Poll.create(
    'Test Poll',
    'Test Description',
    boardId,
    createdBy,
    new Date('2024-01-01'),
    new Date('2024-12-31')
  );
  const poll = pollResult.value;
  (poll as any).props.id = id;

  // Add question with answer
  const questionResult = Question.create(
    'Question 1',
    id,
    1,
    1,
    'single-choice'
  );
  const question = questionResult.value;
  (question as any).props.id = 'question-1';
  const answerResult = Answer.create('Answer 1', 1, question.id);
  question.addAnswer(answerResult.value);
  poll.addQuestion(question);

  // Take snapshot to move to READY state
  poll.takeSnapshot();

  return poll;
}

describe('ActivatePollUseCase', () => {
  let pollRepository: MockPollRepository;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let useCase: ActivatePollUseCase;
  let board: Board;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();

    useCase = new ActivatePollUseCase(
      pollRepository,
      boardRepository,
      organizationRepository,
      userRepository
    );

    // Create a test board
    board = Board.reconstitute({
      id: 'board-1',
      name: 'Test Board',
      organizationId: 'org-1',
      isGeneral: false,
      createdAt: new Date(),
      archivedAt: null,
    });
    boardRepository.save(board);

    // Set admin-1 as admin of org-1
    organizationRepository.setAdmin('admin-1', 'org-1');
  });

  it('should activate poll in READY state', async () => {
    const poll = createReadyPoll('poll-1', board.id, 'admin-1');
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    const updatedPollResult = await pollRepository.getPollById('poll-1');
    expect(updatedPollResult.value?.state).toBe(PollState.ACTIVE);
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is in DRAFT state', async () => {
    // Create poll in DRAFT state (no snapshot)
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      board.id,
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  it('should fail if poll is already ACTIVE', async () => {
    const poll = createReadyPoll('poll-1', board.id, 'admin-1');
    poll.activate();
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  it('should fail if poll is FINISHED', async () => {
    const poll = createReadyPoll('poll-1', board.id, 'admin-1');
    poll.activate();
    poll.finish();
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  describe('authorization', () => {
    it('should reject non-admin user', async () => {
      const poll = createReadyPoll('poll-1', board.id, 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    });

    it('should allow admin user', async () => {
      const poll = createReadyPoll('poll-1', board.id, 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    it('should allow superadmin even if not org admin', async () => {
      userRepository.setSuperAdmin('super-user');
      const poll = createReadyPoll('poll-1', board.id, 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'super-user',
      });

      expect(result.success).toBe(true);
    });
  });
});
