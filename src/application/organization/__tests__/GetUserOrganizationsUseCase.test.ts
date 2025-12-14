import { describe, it, expect, beforeEach } from 'vitest';
import { GetUserOrganizationsUseCase } from '../GetUserOrganizationsUseCase';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
class MockPrismaClient {
  organizationUser = {
    findMany: async (args: any): Promise<any[]> => [],
  };
}

describe('GetUserOrganizationsUseCase', () => {
  let useCase: GetUserOrganizationsUseCase;
  let prisma: MockPrismaClient;
  let memberships: any[];

  beforeEach(() => {
    prisma = new MockPrismaClient();
    memberships = [];

    prisma.organizationUser.findMany = async (args: any) => {
      const filtered = memberships.filter(
        (m) => m.userId === args.where.userId
      );
      // Sort by createdAt descending if orderBy is specified
      if (args.orderBy && args.orderBy.createdAt === 'desc') {
        return filtered.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
      }

      return filtered;
    };

    useCase = new GetUserOrganizationsUseCase({
      prisma: prisma as unknown as PrismaClient,
    });
  });

  it('should return empty lists when user has no organizations', async () => {
    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.member).toEqual([]);
      expect(result.value.pending).toEqual([]);
      expect(result.value.rejected).toEqual([]);
    }
  });

  it('should return organizations where user is an accepted member', async () => {
    memberships.push(
      {
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-01'),
        acceptedAt: new Date('2024-01-02'),
        acceptedByUserId: 'admin-1',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
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
        id: 'membership-2',
        organizationId: 'org-2',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-03'),
        acceptedAt: new Date('2024-01-04'),
        acceptedByUserId: 'admin-2',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-2',
          name: 'Organization Two',
          description: 'Description 2',
          parentId: null,
          createdById: 'creator-2',
          createdAt: new Date('2024-01-03'),
          archivedAt: null,
        },
      }
    );

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.member).toHaveLength(2);
      // Sorted by createdAt desc, so org-2 (Jan 3) comes before org-1 (Jan 1)
      expect(result.value.member[0].organization.name).toBe('Organization Two');
      expect(result.value.member[1].organization.name).toBe('Organization One');
      expect(result.value.pending).toEqual([]);
      expect(result.value.rejected).toEqual([]);
    }
  });

  it('should return organizations with pending join requests', async () => {
    memberships.push({
      id: 'membership-1',
      organizationId: 'org-1',
      userId: 'user-123',
      status: 'pending',
      createdAt: new Date('2024-01-01'),
      acceptedAt: null,
      acceptedByUserId: null,
      rejectedAt: null,
      rejectedByUserId: null,
      rejectionReason: null,
      organization: {
        id: 'org-1',
        name: 'Organization One',
        description: 'Description 1',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date('2024-01-01'),
        archivedAt: null,
      },
    });

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.pending).toHaveLength(1);
      expect(result.value.pending[0].organization.name).toBe(
        'Organization One'
      );
      expect(result.value.pending[0].requestedAt).toBeInstanceOf(Date);
      expect(result.value.member).toEqual([]);
      expect(result.value.rejected).toEqual([]);
    }
  });

  it('should return rejected organizations with rejection details', async () => {
    const rejectedAt = new Date('2024-01-05');
    memberships.push(
      {
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-123',
        status: 'rejected',
        createdAt: new Date('2024-01-01'),
        acceptedAt: null,
        acceptedByUserId: null,
        rejectedAt: rejectedAt,
        rejectedByUserId: 'admin-1',
        rejectionReason: 'Does not meet requirements',
        organization: {
          id: 'org-1',
          name: 'Organization One',
          description: 'Description 1',
          parentId: null,
          createdById: 'creator-1',
          createdAt: new Date('2024-01-01'),
          archivedAt: null,
        },
        rejectedBy: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
        },
      },
      {
        id: 'membership-2',
        organizationId: 'org-2',
        userId: 'user-123',
        status: 'rejected',
        createdAt: new Date('2024-01-03'),
        acceptedAt: null,
        acceptedByUserId: null,
        rejectedAt: new Date('2024-01-06'),
        rejectedByUserId: 'admin-2',
        rejectionReason: null,
        organization: {
          id: 'org-2',
          name: 'Organization Two',
          description: 'Description 2',
          parentId: null,
          createdById: 'creator-2',
          createdAt: new Date('2024-01-03'),
          archivedAt: null,
        },
        rejectedBy: {
          id: 'admin-2',
          firstName: 'Another',
          lastName: 'Admin',
        },
      }
    );

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.rejected).toHaveLength(2);

      // Sorted by createdAt desc, so org-2 (Jan 3) comes before org-1 (Jan 1)
      const rejected1 = result.value.rejected[0];
      expect(rejected1.organization.name).toBe('Organization Two');
      expect(rejected1.rejectionReason).toBeNull();
      expect(rejected1.rejectedBy).toEqual({
        id: 'admin-2',
        firstName: 'Another',
        lastName: 'Admin',
      });

      const rejected2 = result.value.rejected[1];
      expect(rejected2.organization.name).toBe('Organization One');
      expect(rejected2.rejectionReason).toBe('Does not meet requirements');
      expect(rejected2.rejectedAt).toEqual(rejectedAt);
      expect(rejected2.rejectedBy).toEqual({
        id: 'admin-1',
        firstName: 'Admin',
        lastName: 'User',
      });

      expect(result.value.member).toEqual([]);
      expect(result.value.pending).toEqual([]);
    }
  });

  it('should return mixed statuses correctly', async () => {
    memberships.push(
      {
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-01'),
        acceptedAt: new Date('2024-01-02'),
        acceptedByUserId: 'admin-1',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-1',
          name: 'Accepted Org',
          description: 'Description 1',
          parentId: null,
          createdById: 'creator-1',
          createdAt: new Date('2024-01-01'),
          archivedAt: null,
        },
      },
      {
        id: 'membership-2',
        organizationId: 'org-2',
        userId: 'user-123',
        status: 'pending',
        createdAt: new Date('2024-01-03'),
        acceptedAt: null,
        acceptedByUserId: null,
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-2',
          name: 'Pending Org',
          description: 'Description 2',
          parentId: null,
          createdById: 'creator-2',
          createdAt: new Date('2024-01-03'),
          archivedAt: null,
        },
      },
      {
        id: 'membership-3',
        organizationId: 'org-3',
        userId: 'user-123',
        status: 'rejected',
        createdAt: new Date('2024-01-05'),
        acceptedAt: null,
        acceptedByUserId: null,
        rejectedAt: new Date('2024-01-06'),
        rejectedByUserId: 'admin-3',
        rejectionReason: 'Test reason',
        organization: {
          id: 'org-3',
          name: 'Rejected Org',
          description: 'Description 3',
          parentId: null,
          createdById: 'creator-3',
          createdAt: new Date('2024-01-05'),
          archivedAt: null,
        },
        rejectedBy: {
          id: 'admin-3',
          firstName: 'Admin',
          lastName: 'Three',
        },
      }
    );

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.member).toHaveLength(1);
      expect(result.value.member[0].organization.name).toBe('Accepted Org');

      expect(result.value.pending).toHaveLength(1);
      expect(result.value.pending[0].organization.name).toBe('Pending Org');

      expect(result.value.rejected).toHaveLength(1);
      expect(result.value.rejected[0].organization.name).toBe('Rejected Org');
      expect(result.value.rejected[0].rejectionReason).toBe('Test reason');
    }
  });

  it('should sort organizations by membership creation date descending', async () => {
    memberships.push(
      {
        id: 'membership-1',
        organizationId: 'org-1',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-03'),
        acceptedAt: new Date('2024-01-04'),
        acceptedByUserId: 'admin-1',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-1',
          name: 'Second Request',
          description: 'Description 1',
          parentId: null,
          createdById: 'creator-1',
          createdAt: new Date('2024-01-01'),
          archivedAt: null,
        },
      },
      {
        id: 'membership-2',
        organizationId: 'org-2',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-01'),
        acceptedAt: new Date('2024-01-02'),
        acceptedByUserId: 'admin-2',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-2',
          name: 'First Request',
          description: 'Description 2',
          parentId: null,
          createdById: 'creator-2',
          createdAt: new Date('2024-01-05'),
          archivedAt: null,
        },
      },
      {
        id: 'membership-3',
        organizationId: 'org-3',
        userId: 'user-123',
        status: 'accepted',
        createdAt: new Date('2024-01-05'),
        acceptedAt: new Date('2024-01-06'),
        acceptedByUserId: 'admin-3',
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        organization: {
          id: 'org-3',
          name: 'Third Request',
          description: 'Description 3',
          parentId: null,
          createdById: 'creator-3',
          createdAt: new Date('2024-01-03'),
          archivedAt: null,
        },
      }
    );

    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.member).toHaveLength(3);
      // Should be sorted by membership createdAt descending (newest request first)
      expect(result.value.member[0].organization.name).toBe('Third Request');
      expect(result.value.member[1].organization.name).toBe('Second Request');
      expect(result.value.member[2].organization.name).toBe('First Request');
    }
  });
});
