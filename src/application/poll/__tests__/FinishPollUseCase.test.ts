import { describe, it, expect, beforeEach } from 'vitest';
import { FinishPollUseCase } from '../FinishPollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Board } from '../../../domain/board/Board';
import { Organization } from '../../../domain/organization/Organization';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
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
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Vote } from '../../../domain/poll/Vote';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';

class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  private drafts: Map<string, VoteDraft> = new Map();
  public deletedDraftsForPoll: string[] = [];

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

  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    return success([]);
  }

  async getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteParticipant(
    participantId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>> {
    return success(history);
  }

  async getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    this.drafts.set(draft.id, draft);

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
    this.deletedDraftsForPoll.push(pollId);

    return success(undefined);
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
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

  async save(organization: Organization): Promise<Organization> {
    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return null;
  }

  async findByName(name: string): Promise<Organization | null> {
    return null;
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return [];
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
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

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(userId: string): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(
    excludeUserMemberships?: string
  ): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    return [];
  }

  async update(organization: Organization): Promise<Organization> {
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

describe('FinishPollUseCase', () => {
  let repository: MockPollRepository;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let useCase: FinishPollUseCase;
  let poll: Poll;
  let board: Board;

  beforeEach(() => {
    repository = new MockPollRepository();
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();

    useCase = new FinishPollUseCase(
      repository,
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

    // Create a test poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'board-1',
      'user-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    expect(pollResult.success).toBe(true);
    if (pollResult.success) {
      poll = pollResult.value;
      (poll as any).props.id = 'poll-1';

      // Add a question with answer
      const questionResult = Question.create(
        'Question 1',
        poll.id,
        1,
        1,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      if (questionResult.success) {
        const question = questionResult.value;
        (question as any).props.id = 'question-1';

        // Add answer
        const answerResult = Answer.create('Answer 1', 1, question.id);
        (answerResult.value as any).props.id = 'answer-1';
        question.addAnswer(answerResult.value);

        poll.addQuestion(question);
      }

      // Activate the poll
      poll.activate();

      repository.createPoll(poll);
    }
  });

  it('should finish an active poll', async () => {
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Verify poll is finished
    const updatedPollResult = await repository.getPollById(poll.id);
    expect(updatedPollResult.success).toBe(true);
    if (updatedPollResult.success) {
      const updatedPoll = updatedPollResult.value!;
      expect(updatedPoll.finished).toBe(true);
      expect(updatedPoll.active).toBe(false);
    }
  });

  it('should delete all drafts when finishing poll', async () => {
    await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(repository.deletedDraftsForPoll).toContain(poll.id);
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is already finished', async () => {
    // Finish the poll first
    poll.finish();
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_ALREADY_FINISHED);
  });

  it('should finish inactive poll', async () => {
    // Deactivate the poll
    poll.deactivate();
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    const updatedPollResult = await repository.getPollById(poll.id);
    expect(updatedPollResult.success).toBe(true);
    if (updatedPollResult.success) {
      const updatedPoll = updatedPollResult.value!;
      expect(updatedPoll.finished).toBe(true);
    }
  });

  // Authorization tests
  describe('authorization', () => {
    it('should reject non-admin user', async () => {
      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    });

    it('should allow admin user', async () => {
      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    it('should allow superadmin even if not org admin', async () => {
      userRepository.setSuperAdmin('super-user');

      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'super-user',
      });

      expect(result.success).toBe(true);
    });
  });
});
