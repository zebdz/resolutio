/** Verifies Leave Organization behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { BoardName } from '@/domain/board/BoardName';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import {
  notificationIds,
  notificationClock,
} from '@/application/shared/__tests__/notificationCreation';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { BoardId, OrganizationId } from '../../../domain/shared/EntityIds';
import { testCreation } from '../../../domain/shared/__tests__/creation';
import {
  createOrganization,
  organizationTestInstant,
} from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { LeaveOrganizationUseCase } from '../LeaveOrganizationUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Organization } from '../../../domain/organization/Organization';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map();

  async save(board: Board): ReturnType<BoardRepository['save']> {
    this.boards.set(board.id, board);

    return board;
  }

  async findById(id: string): ReturnType<BoardRepository['findById']> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(
    organizationId: string
  ): ReturnType<BoardRepository['findByOrganizationId']> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }

  async findBoardMembers(
    boardId: string
  ): ReturnType<BoardRepository['findBoardMembers']> {
    const members = this.members.get(boardId);

    return members
      ? Array.from(members).map((userId) => ({ userId: UserId.parse(userId) }))
      : [];
  }

  async isUserMember(
    userId: string,
    boardId: string
  ): ReturnType<BoardRepository['isUserMember']> {
    const members = this.members.get(boardId);

    return members ? members.has(userId) : false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): ReturnType<BoardRepository['addUserToBoard']> {
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
  ): ReturnType<BoardRepository['removeUserFromBoard']> {
    const members = this.members.get(boardId);

    if (members) {
      members.delete(userId);
    }
  }

  async update(board: Board): ReturnType<BoardRepository['update']> {
    this.boards.set(board.id, board);

    return board;
  }

  async findActiveBoardsByUserId(
    _userId: string
  ): ReturnType<BoardRepository['findActiveBoardsByUserId']> {
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
  private organizations: Map<string, Organization> = new Map();
  private admins: Map<string, Set<string>> = new Map();
  private members: Map<string, Set<string>> = new Map();

  async save(
    organization: Organization
  ): ReturnType<OrganizationRepository['save']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): ReturnType<OrganizationRepository['findById']> {
    return this.organizations.get(id) || null;
  }

  async findByName(
    name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return [];
  }

  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return [];
  }

  async getAncestorIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getAncestorIds']> {
    return OrganizationId.array().parse([]);
  }

  async getDescendantIds(
    organizationId: string
  ): ReturnType<OrganizationRepository['getDescendantIds']> {
    return OrganizationId.array().parse([]);
  }

  async isUserMember(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    const members = this.members.get(organizationId);

    return members ? members.has(userId) : false;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    _organizationId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }

  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    const members = this.members.get(organizationId);

    if (members) {
      members.delete(userId);
    }
  }

  async findPendingRequestsByUserId(
    _userId: string
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
    return [];
  }

  async findAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const admins = this.admins.get(organizationId);

    return admins ? admins.has(userId) : false;
  }

  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
    return [];
  }

  async findAllWithStats(): ReturnType<
    OrganizationRepository['findAllWithStats']
  > {
    return [];
  }

  // Helper methods
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }

  addMember(organizationId: string, userId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }

    this.members.get(organizationId)!.add(userId);
  }

  async addAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}

  clear(): void {
    this.organizations.clear();
    this.admins.clear();
    this.members.clear();
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
  ): ReturnType<OrganizationRepository['setParentId']> {}
  async findAdminUserIds(): ReturnType<
    OrganizationRepository['findAdminUserIds']
  > {
    return UserId.array().parse([]);
  }
  async searchByNameFuzzy(): ReturnType<
    OrganizationRepository['searchByNameFuzzy']
  > {
    return [];
  }
  async getFullTreeOrgIds(): ReturnType<
    OrganizationRepository['getFullTreeOrgIds']
  > {
    return OrganizationId.array().parse([]);
  }
  async getRootAllowMultiTreeMembership(
    _orgId: string
  ): ReturnType<OrganizationRepository['getRootAllowMultiTreeMembership']> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): ReturnType<
    OrganizationRepository['findUsersWithMultipleMembershipsInOrgs']
  > {
    return UserId.array().parse([]);
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): ReturnType<OrganizationRepository['setAllowMultiTreeMembership']> {}

  async isUserExactMember(
    ..._args: Parameters<OrganizationRepository['isUserExactMember']>
  ): ReturnType<OrganizationRepository['isUserExactMember']> {
    throw new Error('Unexpected isUserExactMember in this test');
  }

  async getAdminUserIds(
    ..._args: Parameters<OrganizationRepository['getAdminUserIds']>
  ): ReturnType<OrganizationRepository['getAdminUserIds']> {
    throw new Error('Unexpected getAdminUserIds in this test');
  }

  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error('Unexpected findAcceptedMemberUserIdsForOrgs in this test');
  }

  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error('Unexpected removeMemberFromOrganization in this test');
  }
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
  private superAdmins: Set<string> = new Set();
  private users: Map<string, User> = new Map();

  async findById(id: string): ReturnType<UserRepository['findById']> {
    return this.users.get(id) || null;
  }

  async findByIds(ids: string[]): ReturnType<UserRepository['findByIds']> {
    return [];
  }

  async findByPhoneNumber(
    phoneNumber: PhoneNumber
  ): ReturnType<UserRepository['findByPhoneNumber']> {
    return null;
  }

  async save(user: User): ReturnType<UserRepository['save']> {
    return user;
  }

  async exists(phoneNumber: PhoneNumber): ReturnType<UserRepository['exists']> {
    return false;
  }

  async searchUsers(query: string): ReturnType<UserRepository['searchUsers']> {
    return [];
  }

  async searchUserByPhone(
    _phone: Parameters<UserRepository['searchUserByPhone']>[0]
  ): ReturnType<UserRepository['searchUserByPhone']> {
    return null;
  }

  async isSuperAdmin(
    userId: string
  ): ReturnType<UserRepository['isSuperAdmin']> {
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

  async findByNickname(): ReturnType<UserRepository['findByNickname']> {
    return null;
  }

  async isNicknameAvailable(): ReturnType<
    UserRepository['isNicknameAvailable']
  > {
    return true;
  }

  async updatePrivacySettings(): ReturnType<
    UserRepository['updatePrivacySettings']
  > {}

  async confirmUser(): ReturnType<UserRepository['confirmUser']> {}

  async deleteAddress(): ReturnType<UserRepository['deleteAddress']> {}

  async findByEmail(
    ..._args: Parameters<UserRepository['findByEmail']>
  ): ReturnType<UserRepository['findByEmail']> {
    throw new Error('Unexpected findByEmail in this test');
  }
}

describe('LeaveOrganizationUseCase', () => {
  let useCase: LeaveOrganizationUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new LeaveOrganizationUseCase({
      ids: notificationIds,
      clock: notificationClock,
      boardRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'non-existent-org',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notFound');
      }
    });
  });

  describe('when organization is archived', () => {
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
        org.archive(organizationTestInstant);
        organizationRepository.addOrganization(org);
      }
    });

    it('should return failure with ARCHIVED error', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.archived');
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
    });

    it('should return failure with NOT_MEMBER error', async () => {
      const result = await useCase.execute({
        userId: 'non-member',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notMember');
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

      organizationRepository.addMember('org-1', 'user-1');
    });

    it('should successfully leave the organization (no boards)', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: [],
      });

      expect(result.success).toBe(true);

      // Verify membership removed
      const isMember = await organizationRepository.isUserMember(
        'user-1',
        'org-1'
      );
      expect(isMember).toBe(false);
    });

    it('should leave selected boards and org', async () => {
      // Set up boards
      const board1Result = Board.create(
        BoardName.parse('Board 1'),
        OrganizationId.parse('org-1'),
        testCreation(BoardId, 'board-fixture')
      );

      if (board1Result.success) {
        const board = Board.reconstitute({
          ...board1Result.value.toJSON(),
          id: 'board-1',
        });
        boardRepository.addBoard(board);
      }

      const board2Result = Board.create(
        BoardName.parse('Board 2'),
        OrganizationId.parse('org-1'),
        testCreation(BoardId, 'board-fixture')
      );

      if (board2Result.success) {
        const board = Board.reconstitute({
          ...board2Result.value.toJSON(),
          id: 'board-2',
        });
        boardRepository.addBoard(board);
      }

      const board3Result = Board.create(
        BoardName.parse('Board 3'),
        OrganizationId.parse('org-1'),
        testCreation(BoardId, 'board-fixture')
      );

      if (board3Result.success) {
        const board = Board.reconstitute({
          ...board3Result.value.toJSON(),
          id: 'board-3',
        });
        boardRepository.addBoard(board);
      }

      // User is member of all boards
      await boardRepository.addUserToBoard('user-1', 'board-1');
      await boardRepository.addUserToBoard('user-1', 'board-2');
      await boardRepository.addUserToBoard('user-1', 'board-3');

      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: ['board-1', 'board-2'],
      });

      expect(result.success).toBe(true);

      // Verify org membership removed
      const isOrgMember = await organizationRepository.isUserMember(
        'user-1',
        'org-1'
      );
      expect(isOrgMember).toBe(false);

      // Verify selected boards left
      const isBoard1Member = await boardRepository.isUserMember(
        'user-1',
        'board-1'
      );
      expect(isBoard1Member).toBe(false);

      const isBoard2Member = await boardRepository.isUserMember(
        'user-1',
        'board-2'
      );
      expect(isBoard2Member).toBe(false);

      // Verify unselected board untouched
      const isBoard3Member = await boardRepository.isUserMember(
        'user-1',
        'board-3'
      );
      expect(isBoard3Member).toBe(true);
    });

    it('should skip non-existent board in boardIdsToLeave and still succeed', async () => {
      const result = await useCase.execute({
        userId: 'user-1',
        organizationId: 'org-1',
        boardIdsToLeave: ['non-existent-board'],
      });

      expect(result.success).toBe(true);

      // Verify org membership still removed
      const isMember = await organizationRepository.isUserMember(
        'user-1',
        'org-1'
      );
      expect(isMember).toBe(false);
    });
  });
});
