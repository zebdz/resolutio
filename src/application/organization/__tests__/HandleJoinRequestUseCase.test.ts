import { PrismaClient } from '@/generated/prisma/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { HandleJoinRequestUseCase } from '../HandleJoinRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Board } from '../../../domain/board/Board';

// Mock PrismaClient
class MockPrismaClient {
  organizationUser = {
    findUnique: async (args: any): Promise<any> => null,

    update: async (args: any): Promise<any> => args.data,
  };
  organizationAdminUser = {
    findUnique: async (args: any): Promise<any> => null,
  };
}

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, any> = new Map();
  private boardMembers: Map<string, Set<string>> = new Map();

  async save(board: Board): Promise<Board> {
    return board;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return [];
  }

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    const board = Array.from(this.boards.values()).find(
      (b) => b.organizationId === organizationId && b.isGeneral
    );

    return board || null;
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    const members = this.boardMembers.get(boardId);

    return members ? members.has(userId) : false;
  }

  async addUserToBoard(userId: string, boardId: string): Promise<void> {
    if (!this.boardMembers.has(boardId)) {
      this.boardMembers.set(boardId, new Set());
    }

    this.boardMembers.get(boardId)!.add(userId);
  }

  async removeUserFromBoard(userId: string, boardId: string): Promise<void> {
    const members = this.boardMembers.get(boardId);
    if (members) {
      members.delete(userId);
    }
  }

  async update(board: Board): Promise<Board> {
    return board;
  }

  // Helper methods for testing
  setGeneralBoard(organizationId: string, boardId: string): void {
    this.boards.set(boardId, {
      id: boardId,
      name: 'General Board',
      organizationId,
      isGeneral: true,
    });
  }

  getBoardMembers(boardId: string): string[] {
    const members = this.boardMembers.get(boardId);

    return members ? Array.from(members) : [];
  }
}

describe('HandleJoinRequestUseCase', () => {
  let useCase: HandleJoinRequestUseCase;
  let prisma: MockPrismaClient;
  let boardRepository: MockBoardRepository;
  let requests: Map<string, any>;
  let adminRoles: Map<string, Set<string>>;

  beforeEach(() => {
    prisma = new MockPrismaClient();
    boardRepository = new MockBoardRepository();
    requests = new Map();
    adminRoles = new Map();

    // Override mock implementations
    prisma.organizationUser.findUnique = async (args: any) => {
      const key = `${args.where.organizationId_userId.organizationId}-${args.where.organizationId_userId.userId}`;

      return requests.get(key) || null;
    };

    prisma.organizationUser.update = async (args: any) => {
      const key = `${args.where.organizationId_userId.organizationId}-${args.where.organizationId_userId.userId}`;
      const existing = requests.get(key);
      if (!existing) {
        throw new Error('Request not found');
      }

      const updated = {
        ...existing,
        ...args.data,
      };
      requests.set(key, updated);

      return updated;
    };

    prisma.organizationAdminUser.findUnique = async (args: any) => {
      const orgId = args.where.organizationId_userId.organizationId;
      const userId = args.where.organizationId_userId.userId;
      const admins = adminRoles.get(orgId);

      return admins && admins.has(userId)
        ? { organizationId: orgId, userId }
        : null;
    };

    useCase = new HandleJoinRequestUseCase({
      prisma: prisma as unknown as PrismaClient,
      boardRepository,
    });
  });

  it('should successfully accept a pending join request', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('accepted');
      expect(updated.acceptedByUserId).toBe(adminId);
      expect(updated.acceptedAt).toBeInstanceOf(Date);
      expect(updated.rejectedAt).toBeNull();
      expect(updated.rejectionReason).toBeNull();
    }
  });

  it('should successfully reject a pending join request with reason', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';
    const rejectionReason = 'Does not meet requirements';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'reject',
      rejectionReason,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('rejected');
      expect(updated.rejectedByUserId).toBe(adminId);
      expect(updated.rejectedAt).toBeInstanceOf(Date);
      expect(updated.rejectionReason).toBe(rejectionReason);
      expect(updated.acceptedAt).toBeNull();
      expect(updated.acceptedByUserId).toBeNull();
    }
  });

  it('should reject a pending join request without reason', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'reject',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const updated = requests.get(key);
      expect(updated.status).toBe('rejected');
      expect(updated.rejectedByUserId).toBe(adminId);
      expect(updated.rejectedAt).toBeInstanceOf(Date);
      expect(updated.rejectionReason).toBeNull();
    }
  });

  it('should fail if admin is not an admin of the organization', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'not-admin-789';

    // Set up: pending request (no admin role)
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('should fail if join request does not exist', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role (but no request)
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.REQUEST_NOT_FOUND);
    }
  });

  it('should fail if join request is not pending', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: already accepted request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'accepted',
      createdAt: new Date(),
      acceptedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: 'other-admin',
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_PENDING);
    }
  });

  it('should automatically add accepted user to general board', async () => {
    const organizationId = 'org-123';
    const requesterId = 'user-456';
    const adminId = 'admin-789';
    const generalBoardId = 'board-general';

    // Set up: admin role
    if (!adminRoles.has(organizationId)) {
      adminRoles.set(organizationId, new Set());
    }

    adminRoles.get(organizationId)!.add(adminId);

    // Set up: general board exists
    boardRepository.setGeneralBoard(organizationId, generalBoardId);

    // Set up: pending request
    const key = `${organizationId}-${requesterId}`;
    requests.set(key, {
      id: 'request-1',
      organizationId,
      userId: requesterId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      acceptedByUserId: null,
      rejectedByUserId: null,
    });

    const result = await useCase.execute({
      organizationId,
      requesterId,
      adminId,
      action: 'accept',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // Verify user was added to general board
      const members = boardRepository.getBoardMembers(generalBoardId);
      expect(members).toContain(requesterId);
    }
  });
});
