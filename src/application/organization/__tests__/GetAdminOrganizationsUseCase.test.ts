import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { createOrganization } from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { GetAdminOrganizationsUseCase } from '../GetAdminOrganizationsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';

// Mock repository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>

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
    for (const org of this.organizations.values()) {
      if (org.name === name) {
        return org;
      }
    }

    return null;
  }

  async findByCreatorId(
    creatorId: string
  ): ReturnType<OrganizationRepository['findByCreatorId']> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.createdById === creatorId
    );
  }

  async findByParentId(
    parentId: string
  ): ReturnType<OrganizationRepository['findByParentId']> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.parentId === parentId
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
    return false;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    const adminOrgs = this.adminRoles.get(userId);

    return adminOrgs ? adminOrgs.has(organizationId) : false;
  }

  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
    return [];
  }

  async findAllWithStats(
    excludeUserMemberships?: string
  ): ReturnType<OrganizationRepository['findAllWithStats']> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
    const adminOrgs = this.adminRoles.get(userId);

    if (!adminOrgs) {
      return [];
    }

    const result: Organization[] = [];

    for (const orgId of adminOrgs) {
      const org = this.organizations.get(orgId);

      if (org) {
        result.push(org);
      }
    }

    return result;
  }

  async update(
    organization: Organization
  ): ReturnType<OrganizationRepository['update']> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  // Helper methods for tests
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  addAdminRole(userId: string, orgId: string) {
    if (!this.adminRoles.has(userId)) {
      this.adminRoles.set(userId, new Set());
    }

    this.adminRoles.get(userId)!.add(orgId);
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

describe('GetAdminOrganizationsUseCase', () => {
  let useCase: GetAdminOrganizationsUseCase;
  let organizationRepository: MockOrganizationRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    useCase = new GetAdminOrganizationsUseCase({
      organizationRepository,
    });
  });

  it('should return an empty list when user is not admin of any organizations', async () => {
    const result = await useCase.execute('user-123');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizations).toEqual([]);
    }
  });

  it('should return organizations where user is admin', async () => {
    const org1Result = createOrganization('Org 1', 'Desc 1', 'creator-1');
    const org2Result = createOrganization('Org 2', 'Desc 2', 'creator-2');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;

      (org1 as any).props.id = 'org-1';
      (org2 as any).props.id = 'org-2';

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);

      // User is admin of both organizations
      organizationRepository.addAdminRole('user-123', 'org-1');
      organizationRepository.addAdminRole('user-123', 'org-2');

      const result = await useCase.execute('user-123');

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
        expect(result.value.organizations.map((org) => org.id)).toEqual([
          'org-1',
          'org-2',
        ]);
      }
    }
  });

  it('should only return organizations where user is admin, not all organizations', async () => {
    const org1Result = createOrganization('Org 1', 'Desc 1', 'creator-1');
    const org2Result = createOrganization('Org 2', 'Desc 2', 'creator-2');
    const org3Result = createOrganization('Org 3', 'Desc 3', 'creator-3');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);
    expect(org3Result.success).toBe(true);

    if (org1Result.success && org2Result.success && org3Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;
      const org3 = org3Result.value;

      (org1 as any).props.id = 'org-1';
      (org2 as any).props.id = 'org-2';
      (org3 as any).props.id = 'org-3';

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);
      organizationRepository.addOrganization(org3);

      // User is admin of only org-1 and org-3
      organizationRepository.addAdminRole('user-123', 'org-1');
      organizationRepository.addAdminRole('user-123', 'org-3');

      const result = await useCase.execute('user-123');

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
        expect(result.value.organizations.map((org) => org.id)).toEqual([
          'org-1',
          'org-3',
        ]);
        // Should not include org-2
        expect(
          result.value.organizations.find((org) => org.id === 'org-2')
        ).toBeUndefined();
      }
    }
  });
});
