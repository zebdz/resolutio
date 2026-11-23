/** Cancellation clients may remove only pending membership links.
 * Tests exercise typed status reads and domain lifecycle failures. */
import { PrismaMembershipStore } from '@/infrastructure/repositories/PrismaMembershipStore';
import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
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

  async save(_org: Organization): ReturnType<OrganizationRepository['save']> {
    return _org;
  }
  async findById(_id: string): ReturnType<OrganizationRepository['findById']> {
    return null;
  }
  async findByName(
    _name: string
  ): ReturnType<OrganizationRepository['findByName']> {
    return null;
  }
  async findByCreatorId(
    _creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return [];
  }
  async findByParentId(
    _parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return [];
  }
  async getAncestorIds(
    _orgId: string
  ): ReturnType<OrganizationRepository['getAncestorIds']> {
    return OrganizationId.array().parse([]);
  }
  async getDescendantIds(
    _orgId: string
  ): ReturnType<OrganizationRepository['getDescendantIds']> {
    return OrganizationId.array().parse([]);
  }
  async isUserMember(
    _userId: string,
    _orgId: string
  ): ReturnType<OrganizationRepository['isUserMember']> {
    return false;
  }
  async isUserAdmin(
    _userId: string,
    _orgId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    return false;
  }
  async findMembershipsByUserId(
    _userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
    return [];
  }
  async findAdminOrganizationsByUserId(
    _userId: string
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
    return [];
  }
  async findAllWithStats(): ReturnType<
    OrganizationRepository['findAllWithStats']
  > {
    return [];
  }
  async update(
    org: Organization
  ): ReturnType<OrganizationRepository['update']> {
    return org;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(
    _orgId: string
  ): ReturnType<
    OrganizationRepository['findAcceptedMemberUserIdsIncludingDescendants']
  > {
    return UserId.array().parse([]);
  }
  async removeUserFromOrganization(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['removeUserFromOrganization']> {
    this.removedMemberships.push({ userId, orgId: organizationId });
  }
  async findPendingRequestsByUserId(
    _userId: string
  ): ReturnType<OrganizationRepository['findPendingRequestsByUserId']> {
    return [];
  }

  // Test helper
  getRemovedMemberships() {
    return this.removedMemberships;
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

  async addAdmin(): ReturnType<OrganizationRepository['addAdmin']> {}
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

  async findAcceptedMemberUserIdsForOrgs(
    ..._args: Parameters<
      OrganizationRepository['findAcceptedMemberUserIdsForOrgs']
    >
  ): ReturnType<OrganizationRepository['findAcceptedMemberUserIdsForOrgs']> {
    throw new Error('Unexpected findAcceptedMemberUserIdsForOrgs in this test');
  }

  async removeMemberFromOrganization(
    ..._args: Parameters<OrganizationRepository['removeMemberFromOrganization']>
  ): ReturnType<OrganizationRepository['removeMemberFromOrganization']> {
    throw new Error('Unexpected removeMemberFromOrganization in this test');
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
      memberships: new PrismaMembershipStore(prisma as unknown as PrismaClient),
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
