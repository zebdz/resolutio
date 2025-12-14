import { describe, it, expect, beforeEach } from 'vitest';
import { GetOrganizationDetailsUseCase } from '../GetOrganizationDetailsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private members: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>
  private admins: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>

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
    return this.members.get(organizationId)?.has(userId) || false;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    return this.admins.get(organizationId)?.has(userId) || false;
  }

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    const memberOrgs: Organization[] = [];
    this.members.forEach((members, orgId) => {
      if (members.has(userId)) {
        const org = this.organizations.get(orgId);
        if (org) {
          memberOrgs.push(org);
        }
      }
    });

    return memberOrgs;
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    const adminOrgs: Organization[] = [];
    this.admins.forEach((admins, orgId) => {
      if (admins.has(userId)) {
        const org = this.organizations.get(orgId);
        if (org) {
          adminOrgs.push(org);
        }
      }
    });

    return adminOrgs;
  }

  async findAllWithStats(excludeUserMemberships?: string): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    return [];
  }

  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  // Helper methods for testing
  addMember(userId: string, organizationId: string): void {
    if (!this.members.has(organizationId)) {
      this.members.set(organizationId, new Set());
    }
    this.members.get(organizationId)!.add(userId);
  }

  addAdmin(userId: string, organizationId: string): void {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }
    this.admins.get(organizationId)!.add(userId);
  }
}

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private boardMembers: Map<string, Set<string>> = new Map(); // boardId -> Set<userId>

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
    return this.boardMembers.get(boardId)?.has(userId) || false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void> {
    if (!this.boardMembers.has(boardId)) {
      this.boardMembers.set(boardId, new Set());
    }
    this.boardMembers.get(boardId)!.add(userId);
  }

  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {
    this.boardMembers.get(boardId)?.delete(userId);
  }

  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  // Helper methods for testing
  addBoardMember(userId: string, boardId: string): void {
    if (!this.boardMembers.has(boardId)) {
      this.boardMembers.set(boardId, new Set());
    }
    this.boardMembers.get(boardId)!.add(userId);
  }
}

// Mock Prisma
class MockPrisma {
  boardUser = {
    count: async ({ where }: any) => {
      // Return a mock count
      return 5;
    },
  };

  organizationAdminUser = {
    findFirst: async ({ where, orderBy, include }: any) => {
      return {
        user: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
        },
      };
    },
  };
}

describe('GetOrganizationDetailsUseCase', () => {
  let useCase: GetOrganizationDetailsUseCase;
  let organizationRepository: MockOrganizationRepository;
  let boardRepository: MockBoardRepository;
  let prisma: MockPrisma;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    boardRepository = new MockBoardRepository();
    prisma = new MockPrisma();

    useCase = new GetOrganizationDetailsUseCase({
      organizationRepository,
      boardRepository,
      prisma: prisma as any,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        organizationId: 'non-existent-id',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
      }
    });
  });

  describe('when organization is archived', () => {
    it('should return failure with ARCHIVED error', async () => {
      const orgResult = Organization.create(
        'Test Organization',
        'Test Description',
        'creator-1'
      );

      expect(orgResult.success).toBe(true);
      if (orgResult.success) {
        const organization = orgResult.value;
        organization.setId('org-1');
        organization.archive();
        await organizationRepository.save(organization);

        const result = await useCase.execute({
          organizationId: 'org-1',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(OrganizationErrors.ARCHIVED);
        }
      }
    });
  });

  describe('when organization exists and is not archived', () => {
    let organization: Organization;
    let board1: Board;
    let board2: Board;

    beforeEach(async () => {
      const orgResult = Organization.create(
        'Test Organization',
        'Test Description',
        'creator-1'
      );

      expect(orgResult.success).toBe(true);
      if (orgResult.success) {
        organization = orgResult.value;
        organization.setId('org-1');
        await organizationRepository.save(organization);
      }

      const board1Result = Board.create('General Board', 'org-1', true);
      expect(board1Result.success).toBe(true);
      if (board1Result.success) {
        board1 = board1Result.value;
        board1.setId('board-1');
        await boardRepository.save(board1);
      }

      const board2Result = Board.create('Special Board', 'org-1', false);
      expect(board2Result.success).toBe(true);
      if (board2Result.success) {
        board2 = board2Result.value;
        board2.setId('board-2');
        await boardRepository.save(board2);
      }
    });

    it('should return organization details without user context', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organization.id).toBe('org-1');
        expect(result.value.organization.name).toBe('Test Organization');
        expect(result.value.boards).toHaveLength(2);
        expect(result.value.isUserMember).toBe(false);
        expect(result.value.isUserAdmin).toBe(false);
      }
    });

    it('should include board member counts', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.boards[0].memberCount).toBe(5);
        expect(result.value.boards[1].memberCount).toBe(5);
      }
    });

    it('should return first admin information', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.firstAdmin).not.toBeNull();
        expect(result.value.firstAdmin?.firstName).toBe('Admin');
        expect(result.value.firstAdmin?.lastName).toBe('User');
      }
    });

    it('should correctly identify user membership status', async () => {
      organizationRepository.addMember('user-1', 'org-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isUserMember).toBe(true);
        expect(result.value.isUserAdmin).toBe(false);
      }
    });

    it('should correctly identify user admin status', async () => {
      organizationRepository.addMember('user-1', 'org-1');
      organizationRepository.addAdmin('user-1', 'org-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.isUserMember).toBe(true);
        expect(result.value.isUserAdmin).toBe(true);
      }
    });

    it('should correctly identify board membership', async () => {
      organizationRepository.addMember('user-1', 'org-1');
      boardRepository.addBoardMember('user-1', 'board-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'user-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const board1Details = result.value.boards.find(
          (b) => b.board.id === 'board-1'
        );
        const board2Details = result.value.boards.find(
          (b) => b.board.id === 'board-2'
        );

        expect(board1Details?.isUserMember).toBe(true);
        expect(board2Details?.isUserMember).toBe(false);
      }
    });

    it('should exclude archived boards', async () => {
      board2.archive();
      await boardRepository.update(board2);

      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.boards).toHaveLength(1);
        expect(result.value.boards[0].board.id).toBe('board-1');
      }
    });
  });
});
