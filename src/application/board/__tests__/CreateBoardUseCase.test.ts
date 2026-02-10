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
  private nextId = 1;

  async save(board: Board): Promise<Board> {
    const id = `board-${this.nextId++}`;
    (board as any).props.id = id;
    this.boards.set(id, board);

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

  // Helper for testing
  clear(): void {
    this.boards.clear();
    this.nextId = 1;
  }
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
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

  async getAncestorIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
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

  addAdmin(organizationId: string, userId: string): void {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
  }

  clear(): void {
    this.organizations.clear();
    this.admins.clear();
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
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
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
      const orgResult = Organization.create(
        'Test Organization',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
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
      const orgResult = Organization.create(
        'Test Organization',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
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
        expect(result.value.board.id).toBeTruthy();
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
      const orgResult = Organization.create(
        'Test Organization',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
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
