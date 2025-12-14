import { describe, it, expect, beforeEach } from 'vitest';
import { GetPendingRequestsUseCase } from '../GetPendingRequestsUseCase';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
class MockPrismaClient {
  organizationAdminUser = {
    findMany: async (args: any): Promise<any[]> => [],
  };
  organizationUser = {
    findMany: async (args: any): Promise<any[]> => [],
  };
}

describe('GetPendingRequestsUseCase', () => {
  let useCase: GetPendingRequestsUseCase;
  let prisma: MockPrismaClient;
  let adminRoles: any[];
  let pendingRequests: any[];

  beforeEach(() => {
    prisma = new MockPrismaClient();
    adminRoles = [];
    pendingRequests = [];

    prisma.organizationAdminUser.findMany = async (args: any) => {
      return adminRoles.filter((role) => role.userId === args.where.userId);
    };

    prisma.organizationUser.findMany = async (args: any) => {
      if (!args.where.organizationId || !args.where.organizationId.in) {
        return [];
      }

      const orgIds = args.where.organizationId.in;

      return pendingRequests
        .filter(
          (req) =>
            orgIds.includes(req.organizationId) && req.status === 'pending'
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    };

    useCase = new GetPendingRequestsUseCase({
      prisma: prisma as unknown as PrismaClient,
    });
  });

  it('should return empty list when user is not admin of any organization', async () => {
    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toEqual([]);
    }
  });

  it('should return empty list when there are no pending requests', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: {
        id: 'org-1',
        name: 'Organization One',
        description: 'Description',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date('2024-01-01'),
        archivedAt: null,
      },
    });

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toEqual([]);
    }
  });

  it('should return pending requests for organizations where user is admin', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: {
        id: 'org-1',
        name: 'Organization One',
        description: 'Description',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date('2024-01-01'),
        archivedAt: null,
      },
    });

    pendingRequests.push({
      id: 'request-1',
      organizationId: 'org-1',
      userId: 'user-456',
      status: 'pending',
      createdAt: new Date('2024-01-10'),
      user: {
        id: 'user-456',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+1234567890',
      },
      organization: {
        id: 'org-1',
        name: 'Organization One',
      },
    });

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toHaveLength(1);
      expect(result.value.requests[0].organizationId).toBe('org-1');
      expect(result.value.requests[0].organizationName).toBe(
        'Organization One'
      );
      expect(result.value.requests[0].requester.id).toBe('user-456');
      expect(result.value.requests[0].requester.firstName).toBe('John');
      expect(result.value.requests[0].requester.lastName).toBe('Doe');
      expect(result.value.requests[0].requester.phoneNumber).toBe(
        '+1234567890'
      );
      expect(result.value.requests[0].requestedAt).toBeInstanceOf(Date);
    }
  });

  it('should return requests grouped by organization', async () => {
    adminRoles.push(
      {
        organizationId: 'org-1',
        userId: 'admin-123',
        organization: {
          id: 'org-1',
          name: 'Organization One',
          description: 'Description 1',
          parentId: null,
          createdById: 'creator-1',
          createdAt: new Date('2024-01-01'),
          archivedAt: null,
        },
      },
      {
        organizationId: 'org-2',
        userId: 'admin-123',
        organization: {
          id: 'org-2',
          name: 'Organization Two',
          description: 'Description 2',
          parentId: null,
          createdById: 'creator-2',
          createdAt: new Date('2024-01-02'),
          archivedAt: null,
        },
      }
    );

    pendingRequests.push(
      {
        id: 'request-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'pending',
        createdAt: new Date('2024-01-10'),
        user: {
          id: 'user-1',
          firstName: 'Alice',
          lastName: 'Smith',
          phoneNumber: '+1111111111',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      },
      {
        id: 'request-2',
        organizationId: 'org-1',
        userId: 'user-2',
        status: 'pending',
        createdAt: new Date('2024-01-11'),
        user: {
          id: 'user-2',
          firstName: 'Bob',
          lastName: 'Johnson',
          phoneNumber: '+2222222222',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      },
      {
        id: 'request-3',
        organizationId: 'org-2',
        userId: 'user-3',
        status: 'pending',
        createdAt: new Date('2024-01-12'),
        user: {
          id: 'user-3',
          firstName: 'Charlie',
          lastName: 'Brown',
          phoneNumber: '+3333333333',
        },
        organization: {
          id: 'org-2',
          name: 'Organization Two',
        },
      }
    );

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toHaveLength(3);

      // First two should be from org-1 (sorted by date)
      expect(result.value.requests[0].organizationName).toBe(
        'Organization One'
      );
      expect(result.value.requests[0].requester.firstName).toBe('Alice');

      expect(result.value.requests[1].organizationName).toBe(
        'Organization One'
      );
      expect(result.value.requests[1].requester.firstName).toBe('Bob');

      // Third should be from org-2
      expect(result.value.requests[2].organizationName).toBe(
        'Organization Two'
      );
      expect(result.value.requests[2].requester.firstName).toBe('Charlie');
    }
  });

  it('should sort requests by date ascending (oldest first)', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: {
        id: 'org-1',
        name: 'Organization One',
        description: 'Description',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date('2024-01-01'),
        archivedAt: null,
      },
    });

    pendingRequests.push(
      {
        id: 'request-1',
        organizationId: 'org-1',
        userId: 'user-3',
        status: 'pending',
        createdAt: new Date('2024-01-15'),
        user: {
          id: 'user-3',
          firstName: 'Third',
          lastName: 'User',
          phoneNumber: '+3333333333',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      },
      {
        id: 'request-2',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'pending',
        createdAt: new Date('2024-01-10'),
        user: {
          id: 'user-1',
          firstName: 'First',
          lastName: 'User',
          phoneNumber: '+1111111111',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      },
      {
        id: 'request-3',
        organizationId: 'org-1',
        userId: 'user-2',
        status: 'pending',
        createdAt: new Date('2024-01-12'),
        user: {
          id: 'user-2',
          firstName: 'Second',
          lastName: 'User',
          phoneNumber: '+2222222222',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      }
    );

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toHaveLength(3);
      // Should be sorted by createdAt ascending
      expect(result.value.requests[0].requester.firstName).toBe('First');
      expect(result.value.requests[1].requester.firstName).toBe('Second');
      expect(result.value.requests[2].requester.firstName).toBe('Third');
    }
  });

  it('should not return requests for organizations where user is not admin', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: {
        id: 'org-1',
        name: 'Organization One',
        description: 'Description',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date('2024-01-01'),
        archivedAt: null,
      },
    });

    pendingRequests.push(
      {
        id: 'request-1',
        organizationId: 'org-1',
        userId: 'user-1',
        status: 'pending',
        createdAt: new Date('2024-01-10'),
        user: {
          id: 'user-1',
          firstName: 'Alice',
          lastName: 'Smith',
          phoneNumber: '+1111111111',
        },
        organization: {
          id: 'org-1',
          name: 'Organization One',
        },
      },
      {
        id: 'request-2',
        organizationId: 'org-2',
        userId: 'user-2',
        status: 'pending',
        createdAt: new Date('2024-01-11'),
        user: {
          id: 'user-2',
          firstName: 'Bob',
          lastName: 'Johnson',
          phoneNumber: '+2222222222',
        },
        organization: {
          id: 'org-2',
          name: 'Organization Two',
        },
      }
    );

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      // Should only return request for org-1, not org-2
      expect(result.value.requests).toHaveLength(1);
      expect(result.value.requests[0].organizationName).toBe(
        'Organization One'
      );
    }
  });
});
