/** Verifies Deactivate Poll behavior through typed core ports.
 * User persistence doubles exclude obsolete moderation methods; access uses the checked moderation port. */
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
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { QuestionId, AnswerId, PollId } from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach } from 'vitest';
import { DeactivatePollUseCase } from '../DeactivatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Vote } from '../../../domain/poll/Vote';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';

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

  async save(organization: Organization): Promise<Organization> {
    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
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

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(
    excludeUserMemberships?: string
  ): ReturnType<OrganizationRepository['findAllWithStats']> {
    return [];
  }

  async update(organization: Organization): Promise<Organization> {
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

class MockBoardRepository implements Pick<BoardRepository, 'findById'> {
  private boards: Map<string, Board> = new Map();

  setBoard(board: Board): void {
    this.boards.set(board.id, board);
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }
}

describe('DeactivatePollUseCase', () => {
  let repository: MockPollRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let boardRepository: MockBoardRepository;
  let useCase: DeactivatePollUseCase;
  let poll: Poll;

  beforeEach(() => {
    repository = new MockPollRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    boardRepository = new MockBoardRepository();

    useCase = new DeactivatePollUseCase(
      repository,
      organizationRepository,
      userRepository,
      boardRepository as unknown as BoardRepository
    );

    // Set admin-1 as admin of org-1
    organizationRepository.setAdmin('admin-1', 'org-1');

    // Create a test poll
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Test Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2024-01-01'), new Date('2024-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);

    if (pollResult.success) {
      poll = pollResult.value;
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: 'poll-1',
      });

      // Add a question with answer
      const questionResult = Question.create(
        QuestionText.parse('Question 1'),
        poll.id,
        pollFixtureCreation(QuestionId),
        PageNumber.parse(1),
        SortOrder.parse(1),
        'single-choice'
      );
      expect(questionResult.success).toBe(true);

      if (questionResult.success) {
        let question = questionResult.value;
        question = Question.reconstitute({
          ...question.toJSON(),
          answers: question.answers,
          id: 'question-1',
        });

        // Add answer
        const answer = expectSuccess(
          Answer.create(
            AnswerText.parse('Answer 1'),
            SortOrder.parse(1),
            question.id,
            testCreation(AnswerId, 'answer-1')
          )
        );
        question.addAnswer(answer);

        poll.addQuestion(question);
      }

      // Take snapshot and activate the poll
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      repository.createPoll(poll);
    }
  });

  it('should deactivate an active poll', async () => {
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Verify poll is deactivated (now in READY state)
    const updatedPollResult = await repository.getPollById(poll.id);
    expect(updatedPollResult.success).toBe(true);

    if (updatedPollResult.success) {
      const updatedPoll = updatedPollResult.value!;
      expect(updatedPoll.isActive()).toBe(false);
      expect(updatedPoll.isReady()).toBe(true);
    }
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is in READY state (not active)', async () => {
    // Deactivate the poll first (moves to READY)
    poll.deactivate();
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
  });

  it('should fail if poll is finished', async () => {
    // Finish the poll
    poll.finish(PollInstant.parse(new Date().toISOString()));
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollDomainCodes.POLL_MUST_BE_ACTIVE);
  });

  // Authorization tests
  describe('authorization', () => {
    it('should reject non-admin user', async () => {
      const result = await useCase.execute({
        pollId: poll.id,
        userId: 'regular-user',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_AUTHORIZED);
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

    const result = await useCase.execute({
      pollId: poll.id,
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

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(expectFailure(result)).toBe(PollErrors.BOARD_ARCHIVED);
  });
});
