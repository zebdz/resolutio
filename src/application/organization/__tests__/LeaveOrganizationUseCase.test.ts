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

  async findBoardMembers(boardId: string): Promise<{ userId: string }[]> {
    const members = this.members.get(boardId);

    return members ? Array.from(members).map((userId) => ({ userId })) : [];
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

  async findActiveBoardsByUserId(
    _userId: string
  ): Promise<Array<{ id: string; name: string; organizationId: string }>> {
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

  async getAncestorIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    const members = this.members.get(organizationId);

    return members ? members.has(userId) : false;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    _organizationId: string
  ): Promise<string[]> {
    return [];
  }

  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    const members = this.members.get(organizationId);

    if (members) {
      members.delete(userId);
    }
  }

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

  addMember(organizationId: string, userId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }

    this.members.get(organizationId)!.add(userId);
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
    this.members.clear();
  }

  async getAncestors(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getChildrenWithStats(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getHierarchyTree(): Promise<{
    ancestors: { id: string; name: string; memberCount: number }[];
    tree: { id: string; name: string; memberCount: number; children: any[] };
  }> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async searchOrganizationsWithStats(): Promise<{
    organizations: any[];
    totalCount: number;
  }> {
    return { organizations: [], totalCount: 0 };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }
  async getFullTreeOrgIds(): Promise<string[]> {
    return [];
  }
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): Promise<string[]> {
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

  async save(notification: Notification): Promise<Notification> {
    this.saved = notification;

    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  getSaved() {
    return this.saved;
  }
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
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

  async searchUserByPhone(_phone: string): Promise<User | null> {
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
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async confirmUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
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
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        org.archive();
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
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
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
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
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
      const board1Result = Board.create('Board 1', 'org-1');

      if (board1Result.success) {
        const board = board1Result.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }

      const board2Result = Board.create('Board 2', 'org-1');

      if (board2Result.success) {
        const board = board2Result.value;
        (board as any).props.id = 'board-2';
        boardRepository.addBoard(board);
      }

      const board3Result = Board.create('Board 3', 'org-1');

      if (board3Result.success) {
        const board = board3Result.value;
        (board as any).props.id = 'board-3';
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
