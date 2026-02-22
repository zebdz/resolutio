import { PrismaClient } from '@/generated/prisma/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { GetPendingRequestsUseCase } from '../GetPendingRequestsUseCase';

// Mock PrismaClient
class MockPrismaClient {
  organizationAdminUser = {
    findMany: async (args: any): Promise<any[]> => [],
  };
  organizationUser = {
    findMany: async (args: any): Promise<any[]> => [],
    count: async (args: any): Promise<number> => 0,
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

      let filtered = pendingRequests
        .filter(
          (req) =>
            orgIds.includes(req.organizationId) && req.status === 'pending'
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (args.skip !== undefined) {
        filtered = filtered.slice(args.skip);
      }

      if (args.take !== undefined) {
        filtered = filtered.slice(0, args.take);
      }

      return filtered;
    };

    prisma.organizationUser.count = async (args: any) => {
      if (!args.where.organizationId || !args.where.organizationId.in) {
        return 0;
      }

      const orgIds = args.where.organizationId.in;

      return pendingRequests.filter(
        (req) =>
          orgIds.includes(req.organizationId) && req.status === 'pending'
      ).length;
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

  it('should return totalCount alongside requests', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: { id: 'org-1', name: 'Org One' },
    });

    pendingRequests.push(
      {
        id: 'r-1',
        organizationId: 'org-1',
        userId: 'u-1',
        status: 'pending',
        createdAt: new Date('2024-01-01'),
        user: { id: 'u-1', firstName: 'A', lastName: 'B', phoneNumber: '+1' },
        organization: { id: 'org-1', name: 'Org One' },
      },
      {
        id: 'r-2',
        organizationId: 'org-1',
        userId: 'u-2',
        status: 'pending',
        createdAt: new Date('2024-01-02'),
        user: { id: 'u-2', firstName: 'C', lastName: 'D', phoneNumber: '+2' },
        organization: { id: 'org-1', name: 'Org One' },
      }
    );

    const result = await useCase.execute('admin-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.totalCount).toBe(2);
      expect(result.value.requests).toHaveLength(2);
    }
  });

  it('should paginate results with page and pageSize', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: { id: 'org-1', name: 'Org One' },
    });

    for (let i = 1; i <= 5; i++) {
      pendingRequests.push({
        id: `r-${i}`,
        organizationId: 'org-1',
        userId: `u-${i}`,
        status: 'pending',
        createdAt: new Date(`2024-01-${String(i).padStart(2, '0')}`),
        user: {
          id: `u-${i}`,
          firstName: `User${i}`,
          lastName: 'Test',
          phoneNumber: `+${i}`,
        },
        organization: { id: 'org-1', name: 'Org One' },
      });
    }

    // Page 1 of size 2
    const result1 = await useCase.execute('admin-123', { page: 1, pageSize: 2 });
    expect(result1.success).toBe(true);
    if (result1.success) {
      expect(result1.value.requests).toHaveLength(2);
      expect(result1.value.totalCount).toBe(5);
      expect(result1.value.requests[0].requester.firstName).toBe('User1');
      expect(result1.value.requests[1].requester.firstName).toBe('User2');
    }

    // Page 2 of size 2
    const result2 = await useCase.execute('admin-123', { page: 2, pageSize: 2 });
    expect(result2.success).toBe(true);
    if (result2.success) {
      expect(result2.value.requests).toHaveLength(2);
      expect(result2.value.totalCount).toBe(5);
      expect(result2.value.requests[0].requester.firstName).toBe('User3');
      expect(result2.value.requests[1].requester.firstName).toBe('User4');
    }

    // Page 3 of size 2 (last page, only 1 item)
    const result3 = await useCase.execute('admin-123', { page: 3, pageSize: 2 });
    expect(result3.success).toBe(true);
    if (result3.success) {
      expect(result3.value.requests).toHaveLength(1);
      expect(result3.value.totalCount).toBe(5);
      expect(result3.value.requests[0].requester.firstName).toBe('User5');
    }
  });

  it('should return all results when no pagination params', async () => {
    adminRoles.push({
      organizationId: 'org-1',
      userId: 'admin-123',
      organization: { id: 'org-1', name: 'Org One' },
    });

    for (let i = 1; i <= 3; i++) {
      pendingRequests.push({
        id: `r-${i}`,
        organizationId: 'org-1',
        userId: `u-${i}`,
        status: 'pending',
        createdAt: new Date(`2024-01-${String(i).padStart(2, '0')}`),
        user: {
          id: `u-${i}`,
          firstName: `User${i}`,
          lastName: 'Test',
          phoneNumber: `+${i}`,
        },
        organization: { id: 'org-1', name: 'Org One' },
      });
    }

    const result = await useCase.execute('admin-123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.requests).toHaveLength(3);
      expect(result.value.totalCount).toBe(3);
    }
  });
});
