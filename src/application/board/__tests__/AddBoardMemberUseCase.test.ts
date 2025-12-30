import { describe, it, expect, beforeEach } from 'vitest';
import { AddBoardMemberUseCase } from '../AddBoardMemberUseCase';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { Organization } from '../../../domain/organization/Organization';

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map(); // boardId -> Set of userIds

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
  private members: Map<string, Set<string>> = new Map(); // orgId -> Set of member userIds

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

  addMember(organizationId: string, userId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }

    this.members.get(organizationId)!.add(userId);
  }

  clear(): void {
    this.organizations.clear();
    this.admins.clear();
    this.members.clear();
  }
}

describe('AddBoardMemberUseCase', () => {
  let useCase: AddBoardMemberUseCase;
  let boardRepository: MockBoardRepository;
  let organizationRepository: MockOrganizationRepository;

  beforeEach(() => {
    boardRepository = new MockBoardRepository();
    organizationRepository = new MockOrganizationRepository();
    useCase = new AddBoardMemberUseCase({
      boardRepository,
      organizationRepository,
    });
  });

  describe('when board does not exist', () => {
    it('should return failure with BOARD_NOT_FOUND error', async () => {
      const result = await useCase.execute({
        boardId: 'non-existent-board',
        userId: 'user-1',
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
        org.setId('org-1');
        organizationRepository.addOrganization(org);
      }

      const boardResult = Board.create('Test Board', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        board.setId('board-1');
        boardRepository.addBoard(board);
      }
    });

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        boardId: 'board-1',
        userId: 'user-1',
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
        org.setId('org-1');
        organizationRepository.addOrganization(org);
        organizationRepository.addAdmin('org-1', 'admin-1');
      }

      const boardResult = Board.create('Test Board', 'org-1');
      if (boardResult.success) {
        const board = boardResult.value;
        board.setId('board-1');
        boardRepository.addBoard(board);
      }

      const generalBoardResult = Board.create('Test Board', 'org-1', true);
      if (generalBoardResult.success) {
        const generalBoard = generalBoardResult.value;
        generalBoard.setId('general-board');
        boardRepository.addBoard(generalBoard);
      }
    });

    it('should succeed when user is not a member of the organization if the board is not general', async () => {
      const result = await useCase.execute({
        boardId: 'board-1',
        userId: 'non-member-user',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);
    });

    it('should fail when user is not a member of the organization if the board is general', async () => {
      const result = await useCase.execute({
        boardId: 'general-board',
        userId: 'non-member-user',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.userNotOrgMember');
      }
    });

    it('should fail when user is already a member of the board', async () => {
      organizationRepository.addMember('org-1', 'user-1');
      await boardRepository.addUserToBoard('user-1', 'board-1');

      const result = await useCase.execute({
        boardId: 'board-1',
        userId: 'user-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.alreadyMember');
      }
    });

    it('should add a user to the board successfully', async () => {
      organizationRepository.addMember('org-1', 'user-1');

      const result = await useCase.execute({
        boardId: 'board-1',
        userId: 'user-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);

      // Verify user was added to board
      const isMember = await boardRepository.isUserMember('user-1', 'board-1');
      expect(isMember).toBe(true);
    });

    it('should fail when trying to add to an archived board', async () => {
      organizationRepository.addMember('org-1', 'user-1');

      const board = await boardRepository.findById('board-1');
      board!.archive();
      await boardRepository.update(board!);

      const result = await useCase.execute({
        boardId: 'board-1',
        userId: 'user-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('board.errors.boardArchived');
      }
    });
  });
});
