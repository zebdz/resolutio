/** Organization details retain board membership, hierarchy and admin visibility.
 * Read projections pass through the typed directory adapter with simulated storage. */
import { BoardName } from '@/domain/board/BoardName';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaOrganizationDirectory } from '@/infrastructure/repositories/PrismaOrganizationDirectory';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { BoardId, OrganizationId } from '../../../domain/shared/EntityIds';
import { testCreation } from '../../../domain/shared/__tests__/creation';
import {
  createOrganization,
  organizationTestInstant,
} from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { GetOrganizationDetailsUseCase } from '../GetOrganizationDetailsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { Board } from '../../../domain/board/Board';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationErrors } from '../OrganizationErrors';
import { UserRepository } from '../../../domain/user/UserRepository';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private members: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>
  private admins: Map<string, Set<string>> = new Map(); // orgId -> Set<userId>

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
    return (
      Array.from(this.organizations.values()).find((o) => o.name === name) ||
      null
    );
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return Array.from(this.organizations.values()).filter(
      (o) => o.createdById === creatorId
    );
  }

  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return Array.from(this.organizations.values()).filter(
      (o) => o.parentId === parentId
    );
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
    return this.members.get(organizationId)?.has(userId) || false;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    return this.admins.get(organizationId)?.has(userId) || false;
  }

  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
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
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
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

  async findAllWithStats(
    excludeUserMemberships?: string
  ): ReturnType<OrganizationRepository['findAllWithStats']> {
    return [];
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
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

  async addAdmin(
    organizationId: string,
    userId: string
  ): ReturnType<OrganizationRepository['addAdmin']> {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
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

  async removeAdmin(): ReturnType<OrganizationRepository['removeAdmin']> {}
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

  async findAcceptedMemberUserIdsIncludingDescendants(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
    >
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    throw new Error(
      'Unexpected findAcceptedMemberUserIdsIncludingDescendants in this test'
    );
  }

  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error('Unexpected findAcceptedMemberUserIdsForOrgs in this test');
  }

  async removeUserFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeUserFromOrganization']>
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    throw new Error('Unexpected removeUserFromOrganization in this test');
  }

  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error('Unexpected removeMemberFromOrganization in this test');
  }

  async findPendingRequestsByUserId(
    ..._args: Parameters<OrganizationRepository['findPendingRequestsByUserId']>
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
    throw new Error('Unexpected findPendingRequestsByUserId in this test');
  }
}

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private boardMembers: Map<string, Set<string>> = new Map(); // boardId -> Set<userId>

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

  async isUserMember(
    userId: string,
    boardId: string
  ): ReturnType<BoardRepository['isUserMember']> {
    return this.boardMembers.get(boardId)?.has(userId) || false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): ReturnType<BoardRepository['addUserToBoard']> {
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
  ): ReturnType<BoardRepository['removeUserFromBoard']> {
    this.boardMembers.get(boardId)?.delete(userId);
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

  // Helper methods for testing
  addBoardMember(userId: string, boardId: string): void {
    if (!this.boardMembers.has(boardId)) {
      this.boardMembers.set(boardId, new Set());
    }

    this.boardMembers.get(boardId)!.add(userId);
  }

  async findBoardMembers(
    ..._args: Parameters<BoardRepository['findBoardMembers']>
  ): ReturnType<BoardRepository['findBoardMembers']> {
    throw new Error('Unexpected findBoardMembers in this test');
  }
}

// Mock Prisma
class MockPrisma {
  private boardUsers: Array<{
    boardId: string;
    userId: string;
    removedAt: null | Date;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
    };
  }> = [];

  boardUser = {
    count: async ({ where }: any) => {
      return this.boardUsers.filter(
        (bu) => bu.boardId === where.boardId && bu.removedAt === null
      ).length;
    },
    findMany: async ({ where, include }: any) => {
      return this.boardUsers
        .filter((bu) => bu.boardId === where.boardId && bu.removedAt === null)
        .map((bu) => ({
          ...bu,
          ...(include?.user ? { user: bu.user } : {}),
        }));
    },
  };

  organizationAdminUser = {
    findFirst: async ({ where, orderBy, include }: any) => {
      return {
        user: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
          middleName: null,
        },
      };
    },
  };

  // Helper for tests
  addBoardUser(
    boardId: string,
    userId: string,
    firstName: string,
    lastName: string,
    middleName: string | null = null
  ) {
    this.boardUsers.push({
      boardId,
      userId,
      removedAt: null,
      user: { id: userId, firstName, lastName, middleName },
    });
  }
}

// Mock UserRepository
class MockUserRepository {
  private superAdmins: Set<string> = new Set();

  async findById() {
    return null;
  }
  async findByIds() {
    return [];
  }
  async findByPhoneNumber() {
    return null;
  }
  async save(user: any) {
    return user;
  }
  async exists() {
    return false;
  }
  async searchUsers() {
    return [];
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string) {
    this.superAdmins.add(userId);
  }
}

describe('GetOrganizationDetailsUseCase', () => {
  let useCase: GetOrganizationDetailsUseCase;
  let organizationRepository: MockOrganizationRepository;
  let boardRepository: MockBoardRepository;
  let prisma: MockPrisma;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    boardRepository = new MockBoardRepository();
    prisma = new MockPrisma();
    userRepository = new MockUserRepository();

    useCase = new GetOrganizationDetailsUseCase({
      organizationRepository,
      boardRepository,
      directory: new PrismaOrganizationDirectory(
        prisma as unknown as PrismaClient
      ),
      userRepository: userRepository as unknown as UserRepository,
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
      const orgResult = createOrganization(
        'Test Organization',
        'Test Description',
        'creator-1'
      );

      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        const organization = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        organization.archive(organizationTestInstant);
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
      const orgResult = createOrganization(
        'Test Organization',
        'Test Description',
        'creator-1'
      );

      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        organization = Organization.reconstitute({
          ...orgResult.value.toJSON(),
          id: 'org-1',
        });
        await organizationRepository.save(organization);
      }

      const board1Result = Board.create(
        BoardName.parse('General Board'),
        OrganizationId.parse('org-1'),
        testCreation(BoardId, 'board-fixture')
      );
      expect(board1Result.success).toBe(true);

      if (board1Result.success) {
        board1 = Board.reconstitute({
          ...board1Result.value.toJSON(),
          id: 'board-1',
        });
        await boardRepository.save(board1);
      }

      const board2Result = Board.create(
        BoardName.parse('Special Board'),
        OrganizationId.parse('org-1'),
        testCreation(BoardId, 'board-fixture')
      );
      expect(board2Result.success).toBe(true);

      if (board2Result.success) {
        board2 = Board.reconstitute({
          ...board2Result.value.toJSON(),
          id: 'board-2',
        });
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
      prisma.addBoardUser('board-1', 'u1', 'Alice', 'Brown');
      prisma.addBoardUser('board-1', 'u2', 'Carol', 'Davis');
      prisma.addBoardUser('board-2', 'u3', 'Evan', 'Fisher');

      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        const b1 = result.value.boards.find((b) => b.board.id === 'board-1');
        const b2 = result.value.boards.find((b) => b.board.id === 'board-2');
        expect(b1?.memberCount).toBe(2);
        expect(b2?.memberCount).toBe(1);
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
      organizationRepository.addAdmin('org-1', 'user-1');

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

    it('should include board members with names', async () => {
      prisma.addBoardUser('board-1', 'user-1', 'Alice', 'Smith', 'Marie');
      prisma.addBoardUser('board-1', 'user-2', 'Bob', 'Jones');
      prisma.addBoardUser('board-2', 'user-3', 'Charlie', 'Brown');

      const result = await useCase.execute({
        organizationId: 'org-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        const b1 = result.value.boards.find((b) => b.board.id === 'board-1');
        const b2 = result.value.boards.find((b) => b.board.id === 'board-2');

        expect(b1?.members).toHaveLength(2);
        expect(b1?.members[0]).toEqual({
          id: 'user-1',
          firstName: 'Alice',
          lastName: 'Smith',
          middleName: 'Marie',
        });
        expect(b1?.members[1]).toEqual({
          id: 'user-2',
          firstName: 'Bob',
          lastName: 'Jones',
          middleName: null,
        });

        expect(b2?.members).toHaveLength(1);
        expect(b2?.members[0]).toEqual({
          id: 'user-3',
          firstName: 'Charlie',
          lastName: 'Brown',
          middleName: null,
        });
      }
    });

    it('should exclude archived boards', async () => {
      board2.archive(organizationTestInstant);
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

    it('should return isUserAdmin true for superadmin even if not org admin', async () => {
      userRepository.addSuperAdmin('superadmin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.isUserAdmin).toBe(true);
      }
    });
  });
});
