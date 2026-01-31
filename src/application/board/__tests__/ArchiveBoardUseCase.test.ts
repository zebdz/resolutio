import { describe, it, expect, beforeEach } from 'vitest';
import { ArchiveBoardUseCase } from '../ArchiveBoardUseCase';
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

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    return (
      Array.from(this.boards.values()).find(
        (b) => b.organizationId === organizationId && b.isGeneral
      ) || null
    );
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
  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }

  clear(): void {
    this.boards.clear();
  }
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
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

  // Helper methods
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

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  clear(): void {
    this.superAdmins.clear();
  }
}

describe('ArchiveBoardUseCase', () => {
  let useCase: ArchiveBoardUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    useCase = new ArchiveBoardUseCase({
      boardRepository,
      organizationRepository,
      userRepository,
    });
  });

  describe('when board does not exist', () => {
    it('should return failure with BOARD_NOT_FOUND error', async () => {
      const result = await useCase.execute({
        boardId: 'non-existent-board',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('board.errors.notFound');
      }
    });
  });

  describe('when user is not an admin of the organization', () => {
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

      const boardResult = Board.create('Test Board', 'org-1');

      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        boardId: 'board-1',
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
        'Test Org',
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

    it('should archive a board successfully', async () => {
      const boardResult = Board.create('Test Board', 'org-1');

      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }

      const result = await useCase.execute({
        boardId: 'board-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);

      // Verify board is archived
      const archivedBoard = await boardRepository.findById('board-1');
      expect(archivedBoard).not.toBeNull();
      expect(archivedBoard!.isArchived()).toBe(true);
      expect(archivedBoard!.archivedAt).not.toBeNull();
    });

    it('should fail when trying to archive an already archived board', async () => {
      const boardResult = Board.create('Test Board', 'org-1');

      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        board.archive(); // Archive it first
        boardRepository.addBoard(board);
      }

      const result = await useCase.execute({
        boardId: 'board-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('domain.board.boardAlreadyArchived');
      }
    });

    it('should fail when trying to archive the general board', async () => {
      const boardResult = Board.create('General Board', 'org-1', true);

      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-general';
        boardRepository.addBoard(board);
      }

      const result = await useCase.execute({
        boardId: 'board-general',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('board.errors.cannotArchiveGeneral');
      }
    });
  });

  describe('when user is a superadmin', () => {
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

      // NOT adding as admin - superadmin should bypass
      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should archive board without being org admin', async () => {
      const boardResult = Board.create('Test Board', 'org-1');

      if (boardResult.success) {
        const board = boardResult.value;
        (board as any).props.id = 'board-1';
        boardRepository.addBoard(board);
      }

      const result = await useCase.execute({
        boardId: 'board-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      const archivedBoard = await boardRepository.findById('board-1');
      expect(archivedBoard!.isArchived()).toBe(true);
    });
  });
});
