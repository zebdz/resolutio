/** Verifies Activate Poll behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { UserId } from '@/domain/shared/EntityIds';
import { UpdateQuestionOrderData } from '@/domain/poll/QuestionRepository';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import {
  pollFixtureCreation,
  pollFixtureIds,
  pollFixtureClock,
} from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { QuestionId, AnswerId, PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActivatePollUseCase } from '../ActivatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { Notification } from '../../../domain/notification/Notification';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Vote } from '../../../domain/poll/Vote';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { PollState } from '../../../domain/poll/PollState';

class MockPollRepository implements PollRepository {
  async searchPolls(): ReturnType<PollRepository['searchPolls']> {
    return success({ polls: [], totalCount: ResultCount.parse(0) });
  }

  private polls: Map<string, Poll> = new Map();

  async createPoll(poll: Poll): ReturnType<PollRepository['createPoll']> {
    this.polls.set(poll.id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): ReturnType<PollRepository['getPollById']> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(
    boardId: string
  ): ReturnType<PollRepository['getPollsByBoardId']> {
    return success([]);
  }

  async getPollsByOrganizationId(
    orgId: string
  ): ReturnType<PollRepository['getPollsByOrganizationId']> {
    return success([]);
  }

  async getPollsByUserId(
    userId: string
  ): ReturnType<PollRepository['getPollsByUserId']> {
    return success([]);
  }

  async updatePoll(poll: Poll): ReturnType<PollRepository['updatePoll']> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): ReturnType<PollRepository['deletePoll']> {
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

class MockOrganizationRepository implements OrganizationRepository {
  private admins: Set<string> = new Set();
  private organizations: Map<string, Organization> = new Map();

  setAdmin(userId: string, organizationId: string): void {
    this.admins.add(`${organizationId}:${userId}`);
  }

  setOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }

  async save(organization: any): Promise<any> {
    return organization;
  }

  async findById(id: string): Promise<any> {
    return this.organizations.get(id) || null;
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

  async getAncestorIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getAncestorIds']> {
    return [];
  }

  async getDescendantIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getDescendantIds']> {
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

  async findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return [];
  }

  async getAncestors(): ReturnType<OrganizationRepository['getAncestors']> {
    return [];
  }

  async getChildrenWithStats(): ReturnType<
    OrganizationRepository['getChildrenWithStats']
  > {
    return [];
  }

  async getHierarchyTree(): ReturnType<
    OrganizationRepository['getHierarchyTree']
  > {
    return {
      ancestors: [],
      tree: {
        id: OrganizationId.parse('org-fixture'),
        name: OrganizationName.parse('Fixture organization'),
        memberCount: MemberCount.parse(0),
        children: [],
      },
    };
  }
  async searchOrganizationsWithStats(): ReturnType<
    OrganizationRepository['searchOrganizationsWithStats']
  > {
    return { organizations: [], totalCount: ResultCount.parse(0) };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {}
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return [];
  }

  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return [];
  }
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return [];
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): Promise<void> {}

  async isUserExactMember(
    ..._args: Parameters<OrganizationRepository['isUserExactMember']>
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    throw new Error('Unexpected test repository call: isUserExactMember');
  }
  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected test repository call: getAdminUserIds');
  }
  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error(
      'Unexpected test repository call: findAcceptedMemberUserIdsForOrgs'
    );
  }
  async removeUserFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeUserFromOrganization']>
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    throw new Error(
      'Unexpected test repository call: removeUserFromOrganization'
    );
  }
  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error(
      'Unexpected test repository call: removeMemberFromOrganization'
    );
  }
  async findPendingRequestsByUserId(
    ..._args: Parameters<OrganizationRepository['findPendingRequestsByUserId']>
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
    throw new Error(
      'Unexpected test repository call: findPendingRequestsByUserId'
    );
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

  async searchUserByPhone(
    _phone: Parameters<UserRepository['searchUserByPhone']>[0]
  ): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}
  async confirmUser(): Promise<void> {}

  async deleteAddress(): Promise<void> {}

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected test repository call: findByEmail');
  }
}

class MockNotificationRepository implements NotificationRepository {
  private savedBatch: Notification[] = [];

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    return success(notification);
  }
  async saveBatch(
    notifications: Notification[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    this.savedBatch.push(...notifications);

    return success(undefined);
  }

  getSavedBatch() {
    return this.savedBatch;
  }
}

class MockParticipantRepository implements ParticipantRepository {
  private participants: Map<string, PollParticipant[]> = new Map();

  async createParticipants(): ReturnType<
    ParticipantRepository['createParticipants']
  > {
    return success(undefined);
  }
  async getParticipants(
    pollId: string
  ): ReturnType<ParticipantRepository['getParticipants']> {
    return success(this.participants.get(pollId) || []);
  }
  async getParticipantById(): ReturnType<
    ParticipantRepository['getParticipantById']
  > {
    return success(null);
  }
  async getParticipantByUserAndPoll(): ReturnType<
    ParticipantRepository['getParticipantByUserAndPoll']
  > {
    return success(null);
  }
  async updateParticipantWeight(): ReturnType<
    ParticipantRepository['updateParticipantWeight']
  > {
    return success(undefined);
  }
  async deleteParticipant(): ReturnType<
    ParticipantRepository['deleteParticipant']
  > {
    return success(undefined);
  }
  async deleteParticipantsByPollId(): ReturnType<
    ParticipantRepository['deleteParticipantsByPollId']
  > {
    return success(undefined);
  }
  async createWeightHistory(): ReturnType<
    ParticipantRepository['createWeightHistory']
  > {
    return success({} as any);
  }
  async getWeightHistory(): ReturnType<
    ParticipantRepository['getWeightHistory']
  > {
    return success([]);
  }
  async getParticipantWeightHistory(): ReturnType<
    ParticipantRepository['getParticipantWeightHistory']
  > {
    return success([]);
  }
  async executeActivation(): ReturnType<
    ParticipantRepository['executeActivation']
  > {
    return success([]);
  }

  setParticipants(pollId: string, participants: PollParticipant[]) {
    this.participants.set(pollId, participants);
  }

  async getCastBallot(
    ..._args: Parameters<ParticipantRepository['getCastBallot']>
  ): ReturnType<ParticipantRepository['getCastBallot']> {
    throw new Error('Unexpected test repository call: getCastBallot');
  }
  async castVotes(
    ..._args: Parameters<ParticipantRepository['castVotes']>
  ): ReturnType<ParticipantRepository['castVotes']> {
    throw new Error('Unexpected test repository call: castVotes');
  }
  async updateWillingToSignProtocol(
    ..._args: Parameters<ParticipantRepository['updateWillingToSignProtocol']>
  ): ReturnType<ParticipantRepository['updateWillingToSignProtocol']> {
    throw new Error(
      'Unexpected test repository call: updateWillingToSignProtocol'
    );
  }
  async joinAndVote(
    ..._args: Parameters<ParticipantRepository['joinAndVote']>
  ): ReturnType<ParticipantRepository['joinAndVote']> {
    throw new Error('Unexpected test repository call: joinAndVote');
  }
  async pollHasVotes(
    ..._args: Parameters<ParticipantRepository['pollHasVotes']>
  ): ReturnType<ParticipantRepository['pollHasVotes']> {
    throw new Error('Unexpected test repository call: pollHasVotes');
  }
  async applyWeightConfigChange(
    ..._args: Parameters<ParticipantRepository['applyWeightConfigChange']>
  ): ReturnType<ParticipantRepository['applyWeightConfigChange']> {
    throw new Error('Unexpected test repository call: applyWeightConfigChange');
  }
}

class MockBoardRepository implements Pick<BoardRepository, 'findById'> {
  private boards: Map<string, Board> = new Map();

  setBoard(board: Board): void {
    this.boards.set(board.id, board);
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
}

// Helper to create a poll in READY state
function createReadyPoll(id: string, boardId: string, createdBy: string): Poll {
  const pollResult = Poll.create(
    PollTitle.parse('Test Poll'),
    PollDescription.parse('Test Description'),
    OrganizationId.parse('org-1'),
    BoardId.parse(boardId),
    UserId.parse(createdBy),
    expectSuccess(
      PollPeriod.create(new Date('2024-01-01'), new Date('2024-12-31'))
    ),
    testCreation(PollId, 'poll-1')
  );
  let poll = expectSuccess(pollResult);
  poll = Poll.reconstitute({
    ...poll.toJSON(),
    questions: poll.questions,
    id: id,
  });

  // Add question with answer
  const questionResult = Question.create(
    QuestionText.parse('Question 1'),
    PollId.parse(id),
    pollFixtureCreation(QuestionId),
    PageNumber.parse(1),
    SortOrder.parse(1),
    'single-choice'
  );
  let question = expectSuccess(questionResult);
  question = Question.reconstitute({
    ...question.toJSON(),
    answers: question.answers,
    id: 'question-1',
  });
  const answerResult = Answer.create(
    AnswerText.parse('Answer 1'),
    SortOrder.parse(1),
    question.id,
    pollFixtureCreation(AnswerId)
  );
  question.addAnswer(expectSuccess(answerResult));
  poll.addQuestion(question);

  // Take snapshot to move to READY state
  poll.submitToAdmin();
  poll.takeSnapshot();

  return poll;
}

describe('ActivatePollUseCase', () => {
  let pollRepository: MockPollRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;
  let participantRepository: MockParticipantRepository;
  let boardRepository: MockBoardRepository;
  let useCase: ActivatePollUseCase;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    participantRepository = new MockParticipantRepository();
    boardRepository = new MockBoardRepository();

    useCase = new ActivatePollUseCase(
      pollRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
      participantRepository,
      boardRepository as unknown as BoardRepository,
      pollFixtureIds,
      pollFixtureClock
    );

    // Set admin-1 as admin of org-1
    organizationRepository.setAdmin('admin-1', 'org-1');
  });

  it('should activate poll in READY state', async () => {
    const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    const updatedPollResult = await pollRepository.getPollById('poll-1');
    expect(expectSuccess(updatedPollResult)?.state).toBe(PollState.ACTIVE);
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is in DRAFT state', async () => {
    // Create poll in DRAFT state (no snapshot)
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
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  it('should fail if poll is already ACTIVE', async () => {
    const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
    poll.activate();
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  it('should fail if poll is FINISHED', async () => {
    const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
    poll.activate();
    poll.finish(PollInstant.parse(new Date().toISOString()));
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_READY);
  });

  describe('authorization', () => {
    it('should reject non-admin user', async () => {
      const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_AUTHORIZED);
    });

    it('should allow admin user', async () => {
      const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    it('should allow superadmin even if not org admin', async () => {
      userRepository.setSuperAdmin('super-user');
      const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
      await pollRepository.createPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'super-user',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('notifications', () => {
    it('should notify all participants on activation', async () => {
      const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
      await pollRepository.createPoll(poll);

      participantRepository.setParticipants('poll-1', [
        PollParticipant.reconstitute({
          id: 'p-1',
          pollId: 'poll-1',
          userId: 'user-1',
          userWeight: 1.0,
          willingToSignProtocol: null,
          snapshotAt: new Date(),
          createdAt: new Date(),
        }),
        PollParticipant.reconstitute({
          id: 'p-2',
          pollId: 'poll-1',
          userId: 'user-2',
          userWeight: 1.0,
          willingToSignProtocol: null,
          snapshotAt: new Date(),
          createdAt: new Date(),
        }),
      ]);

      await useCase.execute({ pollId: 'poll-1', userId: 'admin-1' });

      const saved = notificationRepository.getSavedBatch();
      expect(saved).toHaveLength(2);
      expect(saved[0].type).toBe('poll_activated');
      expect(saved.map((n) => n.userId)).toContain('user-1');
      expect(saved.map((n) => n.userId)).toContain('user-2');
    });

    it('should not send notifications if activation fails', async () => {
      // Poll in DRAFT state -> activation fails
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
      let poll = expectSuccess(pollResult);
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: 'poll-1',
      });
      await pollRepository.createPoll(poll);

      await useCase.execute({ pollId: 'poll-1', userId: 'admin-1' });

      expect(notificationRepository.getSavedBatch()).toHaveLength(0);
    });
  });

  it('should fail if organization is archived', async () => {
    const archivedOrg = Organization.reconstitute({
      id: 'org-1',
      name: 'Archived Org',
      description: 'desc',
      parentId: null,
      createdById: 'user-1',
      createdAt: new Date(),
      archivedAt: new Date(),
      allowMultiTreeMembership: false,
    });
    organizationRepository.setOrganization(archivedOrg);

    const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.ORGANIZATION_ARCHIVED);
  });

  it('should fail if board is archived', async () => {
    boardRepository.setBoard(
      Board.reconstitute({
        id: 'board-1',
        name: 'Archived Board',
        organizationId: 'org-1',
        createdAt: new Date(),
        archivedAt: new Date(),
      })
    );

    const poll = createReadyPoll('poll-1', 'board-1', 'admin-1');
    await pollRepository.createPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.BOARD_ARCHIVED);
  });
  describe('open polls', () => {
    function createReadyOpenPoll(id: string, createdBy: string): Poll {
      let poll = expectSuccess(
        Poll.create(
          PollTitle.parse('Open Poll'),
          PollDescription.parse('Everyone may vote'),
          OrganizationId.parse('org-1'),
          null,
          UserId.parse(createdBy),
          expectSuccess(
            PollPeriod.create(new Date('2026-01-01'), new Date('2026-02-01'))
          ),
          testCreation(PollId, 'poll-1'),
          undefined,
          'OPEN'
        )
      );
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: id,
      });

      let question = expectSuccess(
        Question.create(
          QuestionText.parse('Question 1'),
          PollId.parse(id),
          pollFixtureCreation(QuestionId),
          PageNumber.parse(1),
          SortOrder.parse(1),
          'single-choice'
        )
      );
      question = Question.reconstitute({
        ...question.toJSON(),
        answers: question.answers,
        id: 'question-open-1',
      });
      question.addAnswer(
        expectSuccess(
          Answer.create(
            AnswerText.parse('Answer 1'),
            SortOrder.parse(1),
            question.id,
            pollFixtureCreation(AnswerId)
          )
        )
      );
      poll.addQuestion(question);
      poll.submitToAdmin();
      poll.takeSnapshot();

      return poll;
    }

    it('notifies org members including descendants, not participants', async () => {
      const poll = createReadyOpenPoll('poll-open', 'admin-1');
      await pollRepository.createPoll(poll);

      organizationRepository.findAcceptedMemberUserIdsIncludingDescendants =
        async () => [UserId.parse('member-1'), UserId.parse('member-2')];

      const result = await useCase.execute({
        pollId: 'poll-open',
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);

      const saved = notificationRepository.getSavedBatch();
      expect(saved.map((n) => n.userId)).toEqual(['member-1', 'member-2']);
      expect(saved[0].type).toBe('poll_activated');
    });

    it('sends nothing when the organization has no members', async () => {
      const poll = createReadyOpenPoll('poll-open', 'admin-1');
      await pollRepository.createPoll(poll);

      organizationRepository.findAcceptedMemberUserIdsIncludingDescendants =
        async () => [];

      const result = await useCase.execute({
        pollId: 'poll-open',
        userId: 'admin-1',
      });

      expect(result.success).toBe(true);
      expect(notificationRepository.getSavedBatch()).toHaveLength(0);
    });
  });
});
