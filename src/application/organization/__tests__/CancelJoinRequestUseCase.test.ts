import { PrismaClient } from '@/generated/prisma/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { CancelJoinRequestUseCase } from '../CancelJoinRequestUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';

// Mock PrismaClient
class MockPrismaClient {
  organizationUser = {
    findUnique: async (_args: any): Promise<any> => null,
  };
}

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private removedMemberships: Array<{ userId: string; orgId: string }> = [];

  async save(_org: Organization): Promise<Organization> {
    return _org;
  }
  async findById(_id: string): Promise<Organization | null> {
    return null;
  }
  async findByName(_name: string): Promise<Organization | null> {
    return null;
  }
  async findByCreatorId(_creatorId: string): Promise<Organization[]> {
    return [];
  }
  async findByParentId(_parentId: string): Promise<Organization[]> {
    return [];
  }
  async getAncestorIds(_orgId: string): Promise<string[]> {
    return [];
  }
  async getDescendantIds(_orgId: string): Promise<string[]> {
    return [];
  }
  async isUserMember(_userId: string, _orgId: string): Promise<boolean> {
    return false;
  }
  async isUserAdmin(_userId: string, _orgId: string): Promise<boolean> {
    return false;
  }
  async findMembershipsByUserId(_userId: string): Promise<Organization[]> {
    return [];
  }
  async findAdminOrganizationsByUserId(
    _userId: string
  ): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    return [];
  }
  async update(org: Organization): Promise<Organization> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(
    _orgId: string
  ): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): Promise<void> {
    this.removedMemberships.push({ userId, orgId: organizationId });
  }
  async findPendingRequestsByUserId(_userId: string): Promise<Organization[]> {
    return [];
  }

  // Test helper
  getRemovedMemberships() {
    return this.removedMemberships;
  }

  async getAncestors(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getChildrenWithStats(): Promise<
    { id: string; name: string; memberCount: number }[]
  > {
    return [];
  }

  async getHierarchyTree(): Promise<{
    ancestors: { id: string; name: string; memberCount: number }[];
    tree: { id: string; name: string; memberCount: number; children: any[] };
  }> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
}

describe('CancelJoinRequestUseCase', () => {
  let useCase: CancelJoinRequestUseCase;
  let prisma: MockPrismaClient;
  let organizationRepository: MockOrganizationRepository;

  beforeEach(() => {
    prisma = new MockPrismaClient();
    organizationRepository = new MockOrganizationRepository();
    useCase = new CancelJoinRequestUseCase({
      prisma: prisma as unknown as PrismaClient,
      organizationRepository,
    });
  });

  it('should cancel a pending request', async () => {
    const organizationId = 'org-123';
    const userId = 'user-456';

    // Set up: pending request exists
    prisma.organizationUser.findUnique = async () => ({
      organizationId,
      userId,
      status: 'pending',
      createdAt: new Date(),
      acceptedAt: null,
      rejectedAt: null,
    });

    const result = await useCase.execute({ organizationId, userId });

    expect(result.success).toBe(true);
    expect(organizationRepository.getRemovedMemberships()).toEqual([
      { userId, orgId: organizationId },
    ]);
  });

  it('should fail if request not found', async () => {
    // Default: findUnique returns null
    const result = await useCase.execute({
      organizationId: 'org-123',
      userId: 'user-456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.REQUEST_NOT_FOUND);
    }
  });

  it('should fail if request is not pending (e.g., already accepted)', async () => {
    const organizationId = 'org-123';
    const userId = 'user-456';

    // Set up: accepted request
    prisma.organizationUser.findUnique = async () => ({
      organizationId,
      userId,
      status: 'accepted',
      createdAt: new Date(),
      acceptedAt: new Date(),
      rejectedAt: null,
    });

    const result = await useCase.execute({ organizationId, userId });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.NOT_PENDING);
    }
  });
});
