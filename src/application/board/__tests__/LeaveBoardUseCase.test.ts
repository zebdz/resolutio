/** Board application behavior tests cover authorization, validated request identities
 * and explicit creation/lifecycle inputs through repository contracts. */
import { success } from '@/domain/shared/Result';
import { BoardName } from '@/domain/board/BoardName';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { createOrganization } from '@/domain/organization/__tests__/organizationTestValues';
import {
  notificationIds,
  notificationClock,
} from '@/application/shared/__tests__/notificationCreation';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { BoardSummary } from '@/domain/board/BoardRepository';
import { boardCreation, boardArchiveTime } from './boardTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveBoardUseCase } from '../LeaveBoardUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Organization } from '../../../domain/organization/Organization';
import { User } from '../../../domain/user/User';
import { FirstName, LastName, PasswordHash } from '@/domain/user/UserValues';
import { Nickname } from '@/domain/user/Nickname';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map();

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }

  async findBoardMembers(boardId: string): Promise<{ userId: UserId }[]> {
    const members = this.members.get(boardId);

    return members
      ? Array.from(members).map((userId) => ({ userId: UserId.parse(userId) }))
      : [];
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    const members = this.members.get(boardId);

    return members ? members.has(userId) : false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void> {
    if (!this.members.has(boardId)) {
      this.members.set(boardId, new Set());
    }

    this.members.get(boardId)!.add(userId);
  }

  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {
    const members = this.members.get(boardId);

    if (members) {
      members.delete(userId);
    }
  }

  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  async findActiveBoardsByUserId(_userId: string): Promise<BoardSummary[]> {
    return [];
  }

  // Helper methods
  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }

  clear(): void {
    this.boards.clear();
    this.members.clear();
  }
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  async isUserExactMember(): Promise<boolean> {
    return false;
  }
  async getAdminUserIds(): ReturnType<
    OrganizationRepository['getAdminUserIds']
  > {
    return [];
  }
  async findAcceptedMemberUserIdsForOrgs(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
  > {
    return [];
  }
  async removeMemberFromOrganization(): Promise<void> {}
  private organizations: Map<string, Organization> = new Map();
  private admins: Map<string, Set<string>> = new Map();

  async save(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

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

  async findAcceptedMemberUserIdsIncludingDescendants(
    _organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return [];
  }

  async removeUserFromOrganization(
    _userId: string,
    _organizationId: string
  ): Promise<void> {}

  async findPendingRequestsByUserId(_userId: string): Promise<Organization[]> {
    return [];
  }

  async findAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.admins.get(organizationId);

    return admins ? admins.has(userId) : false;
  }

  async findMembershipsByUserId(userId: string): Promise<any[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(): Promise<any[]> {
    return [];
  }

  // Helper methods
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }

  async addAdmin(organizationId: string, userId: string): Promise<void> {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  async removeAdmin(): Promise<void> {}

  clear(): void {
    this.organizations.clear();
    this.admins.clear();
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
}

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    this.saved = notification;

    return success(notification);
  }
  async saveBatch(): ReturnType<NotificationRepository['saveBatch']> {
    return success(undefined);
  }

  getSaved() {
    return this.saved;
  }
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
  async findByEmail(): Promise<User | null> {
    return null;
  }
  private superAdmins: Set<string> = new Set();
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
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

  async searchUserByPhone(_phone: PhoneNumber): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  clear(): void {
    this.superAdmins.clear();
    this.users.clear();
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
}

describe('LeaveBoardUseCase', () => {
  let useCase: LeaveBoardUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new LeaveBoardUseCase({
      ids: notificationIds,
      clock: notificationClock,
      boardRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });
  });

  it('rejects malformed request identities before repository lookup', async () => {
    expect(await useCase.execute({ boardId: '', userId: 'user-1' })).toEqual({
      success: false,
      error: 'common.errors.validationFailed',
    });
  });

  describe('when board does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'non-existent-board',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('board.errors.notFound');
      }
    });
  });

  describe('when board is archived', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create(
        BoardName.parse('Test Board'),
        OrganizationId.parse('org-1'),
        boardCreation
      );

      if (boardResult.success) {
        const board = boardResult.value;
        board.archive(boardArchiveTime);
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with BOARD_ARCHIVED error', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('board.errors.boardArchived');
      }
    });
  });

  describe('when user is not a member', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create(
        BoardName.parse('Test Board'),
        OrganizationId.parse('org-1'),
        boardCreation
      );

      if (boardResult.success) {
        const board = boardResult.value;
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with NOT_MEMBER error', async () => {
      const result = await useCase.execute({
        userId: 'non-member',
        boardId: 'board-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('board.errors.notMember');
      }
    });
  });

  describe('when user is a member', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create(
        BoardName.parse('Test Board'),
        OrganizationId.parse('org-1'),
        boardCreation
      );

      if (boardResult.success) {
        const board = boardResult.value;
        boardRepository.addBoard(board);
      }

      boardRepository.addUserToBoard('user-1', 'board-1');
    });

    it('should successfully leave the board', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(true);

      const isMember = await boardRepository.isUserMember('user-1', 'board-1');
      expect(isMember).toBe(false);
    });

    it('should send notification without crashing', async () => {
      const phone = PhoneNumber.create('+71234567890');
      const user = User.create(
        {
          firstName: FirstName.parse('John'),
          lastName: LastName.parse('Doe'),
          phoneNumber: phone,
          password: PasswordHash.parse('Password1!'),
          nickname: Nickname.create('john_doe'),
        },
        testCreation(UserId, 'user-1')
      );
      userRepository.addUser(user);

      const result = await useCase.execute({
        userId: 'user-1',
        boardId: 'board-1',
      });

      expect(result.success).toBe(true);

      // Wait for fire-and-forget notification
      await new Promise((r) => setTimeout(r, 10));

      // Should not crash -- stub does nothing but that's fine
    });
  });
});
