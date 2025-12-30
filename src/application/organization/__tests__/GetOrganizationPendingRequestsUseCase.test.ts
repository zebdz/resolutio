import { describe, it, expect, beforeEach } from 'vitest';
import { GetOrganizationPendingRequestsUseCase } from '../GetOrganizationPendingRequestsUseCase';
import { OrganizationErrors } from '../OrganizationErrors';

// Mock Prisma
class MockPrisma {
  private organizations: Map<string, any> = new Map();
  private organizationAdmins: Map<string, Set<string>> = new Map();
  private organizationUsers: any[] = [];

  organization = {
    findUnique: async ({ where }: any) => {
      return this.organizations.get(where.id) || null;
    },
  };

  organizationAdminUser = {
    findUnique: async ({ where }: any) => {
      const orgId = where.organizationId_userId.organizationId;
      const userId = where.organizationId_userId.userId;
      const admins = this.organizationAdmins.get(orgId);

      return admins && admins.has(userId)
        ? { organizationId: orgId, userId }
        : null;
    },
  };

  organizationUser = {
    findMany: async ({ where, include, orderBy }: any) => {
      const filtered = this.organizationUsers.filter(
        (ou) =>
          ou.organizationId === where.organizationId &&
          ou.status === where.status
      );

      // Sort by createdAt if orderBy is specified
      if (orderBy) {
        filtered.sort((a, b) => {
          const order = Array.isArray(orderBy)
            ? orderBy[0].createdAt
            : orderBy.createdAt;
          if (order === 'asc') {
            return a.createdAt.getTime() - b.createdAt.getTime();
          }

          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      }

      return filtered.map((ou) => ({
        ...ou,
        user: ou.user,
      }));
    },
  };

  // Helper methods for testing
  addOrganization(id: string, name: string): void {
    this.organizations.set(id, { id, name });
  }

  addAdmin(organizationId: string, userId: string): void {
    if (!this.organizationAdmins.has(organizationId)) {
      this.organizationAdmins.set(organizationId, new Set());
    }

    this.organizationAdmins.get(organizationId)!.add(userId);
  }

  addPendingRequest(
    organizationId: string,
    user: {
      id: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      phoneNumber: string;
    },
    createdAt: Date
  ): void {
    this.organizationUsers.push({
      organizationId,
      userId: user.id,
      status: 'pending',
      createdAt,
      user,
    });
  }

  clear(): void {
    this.organizations.clear();
    this.organizationAdmins.clear();
    this.organizationUsers = [];
  }
}

describe('GetOrganizationPendingRequestsUseCase', () => {
  let useCase: GetOrganizationPendingRequestsUseCase;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = new MockPrisma();
    useCase = new GetOrganizationPendingRequestsUseCase({
      prisma: prisma as any,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        organizationId: 'non-existent',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.NOT_FOUND);
      }
    });
  });

  describe('when user is not an admin', () => {
    beforeEach(() => {
      prisma.addOrganization('org-1', 'Test Org');
    });

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'non-admin-user',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.NOT_ADMIN);
      }
    });
  });

  describe('when user is an admin', () => {
    beforeEach(() => {
      prisma.addOrganization('org-1', 'Test Org');
      prisma.addAdmin('org-1', 'admin-1');
    });

    it('should return empty array when no pending requests', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.requests).toEqual([]);
      }
    });

    it('should return pending requests for the organization', async () => {
      const now = new Date();
      prisma.addPendingRequest(
        'org-1',
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+1234567890',
        },
        now
      );

      prisma.addPendingRequest(
        'org-1',
        {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          middleName: 'Ann',
          phoneNumber: '+1234567891',
        },
        new Date(now.getTime() + 1000)
      );

      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.requests).toHaveLength(2);
        expect(result.value.requests[0].userId).toBe('user-1');
        expect(result.value.requests[0].firstName).toBe('John');
        expect(result.value.requests[0].lastName).toBe('Doe');
        expect(result.value.requests[0].phoneNumber).toBe('+1234567890');
        expect(result.value.requests[0].middleName).toBeUndefined();

        expect(result.value.requests[1].userId).toBe('user-2');
        expect(result.value.requests[1].middleName).toBe('Ann');
      }
    });

    it('should only return pending requests for the specified organization', async () => {
      prisma.addOrganization('org-2', 'Another Org');
      prisma.addAdmin('org-2', 'admin-2');

      const now = new Date();
      prisma.addPendingRequest(
        'org-1',
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+1234567890',
        },
        now
      );

      prisma.addPendingRequest(
        'org-2',
        {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '+1234567891',
        },
        now
      );

      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.requests).toHaveLength(1);
        expect(result.value.requests[0].userId).toBe('user-1');
      }
    });

    it('should return requests ordered by creation date (oldest first)', async () => {
      const now = new Date();
      prisma.addPendingRequest(
        'org-1',
        {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '+1234567891',
        },
        new Date(now.getTime() + 2000)
      );

      prisma.addPendingRequest(
        'org-1',
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          phoneNumber: '+1234567890',
        },
        new Date(now.getTime() + 1000)
      );

      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.requests).toHaveLength(2);
        // Should be ordered by creation time (oldest first)
        expect(result.value.requests[0].userId).toBe('user-1');
        expect(result.value.requests[1].userId).toBe('user-2');
      }
    });
  });
});
