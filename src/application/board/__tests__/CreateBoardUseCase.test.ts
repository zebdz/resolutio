/** Board application behavior tests cover authorization, validated request identities
 * and explicit creation/lifecycle inputs through repository contracts. */
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { createOrganization } from '@/domain/organization/__tests__/organizationTestValues';
import { UserId } from '@/domain/shared/EntityIds';
import { BoardSummary } from '@/domain/board/BoardRepository';
import { boardCreation, createBoardIds, boardClock } from './boardTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { CreateBoardUseCase } from '../CreateBoardUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Organization } from '../../../domain/organization/Organization';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

// Mock BoardRepository
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
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }

  async findBoardMembers(boardId: string): Promise<{ userId: UserId }[]> {
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

  async findActiveBoardsByUserId(_userId: string): Promise<BoardSummary[]> {
    return [];
  }

  // Helper for testing
  clear(): void {
    this.boards.clear();
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
  async findAcceptedMemberUserIdsIncludingDescendants(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return [];
  }
  async findAcceptedMemberUserIdsForOrgs(): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
  > {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async removeMemberFromOrganization(): Promise<void> {}
  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }
  private organizations: Map<string, Organization> = new Map();
  private admins: Map<string, Set<string>> = new Map(); // orgId -> Set of admin userIds

  async save(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findByName(name: string): Promise<Organization | null> {
    return (
      Array.from(this.organizations.values()).find((o) => o.name === name) ||
      null
    );
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (o) => o.createdById === creatorId
    );
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (o) => o.parentId === parentId
    );
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

  // Helper methods for testing
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

// Mock UserRepository
class MockUserRepository implements UserRepository {
  async findByEmail(): Promise<User | null> {
    return null;
  }
  private superAdmins: Set<string> = new Set();

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

  async searchUserByPhone(_phone: PhoneNumber): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  // Helper for testing
  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  clear(): void {
    this.superAdmins.clear();
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

describe('CreateBoardUseCase', () => {
  let useCase: CreateBoardUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    useCase = new CreateBoardUseCase({
      ids: createBoardIds(),
      clock: boardClock,
      boardRepository,
      organizationRepository,
      userRepository,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        name: 'Test Board',
        organizationId: 'non-existent-org',
        adminUserId: 'user-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notFound');
      }
    });
  });

  describe('when user is not an admin', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Organization',
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

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        name: 'Test Board',
        organizationId: 'org-1',
        adminUserId: 'non-admin-user',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notAdmin');
      }
    });
  });

  describe('when user is an admin', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Organization',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organizationRepository.addOrganization(org);
        organizationRepository.addAdmin('org-1', 'admin-1');
      }
    });

    it('should create a board successfully', async () => {
      const result = await useCase.execute({
        name: 'Test Board',
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.board.name).toBe('Test Board');
        expect(result.value.board.organizationId).toBe('org-1');
        expect(result.value.board.id).toBe(boardCreation.id);
        expect(result.value.board.createdAt).toBe(boardCreation.now);
      }
    });

    it('should fail when board name is empty', async () => {
      const result = await useCase.execute({
        name: '   ',
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('domain.board.boardNameEmpty');
      }
    });

    it('should fail when board name is too long', async () => {
      const longName = 'a'.repeat(256);
      const result = await useCase.execute({
        name: longName,
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('domain.board.boardNameTooLong');
      }
    });

    it('should allow creating multiple boards for the same organization', async () => {
      const result1 = await useCase.execute({
        name: 'Board 1',
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      const result2 = await useCase.execute({
        name: 'Board 2',
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.value.board.id).not.toBe(result2.value.board.id);
      }
    });
  });

  describe('when user is a superadmin', () => {
    beforeEach(() => {
      const orgResult = createOrganization(
        'Test Organization',
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

      // NOT adding as admin - superadmin should bypass
      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should create board without being org admin', async () => {
      const result = await useCase.execute({
        name: 'Test Board',
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.board.name).toBe('Test Board');
      }
    });
  });
});
