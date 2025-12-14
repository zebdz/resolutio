import { describe, it, expect, beforeEach } from 'vitest';
import { HandleJoinRequestUseCase } from '../HandleJoinRequestUseCase';
import { PrismaClient } from '@prisma/client';
import { OrganizationErrors } from '../OrganizationErrors';

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

describe('HandleJoinRequestUseCase', () => {
  let useCase: HandleJoinRequestUseCase;
  let prisma: MockPrismaClient;
  let requests: Map<string, any>;
  let adminRoles: Map<string, Set<string>>;

  beforeEach(() => {
    prisma = new MockPrismaClient();
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
});
