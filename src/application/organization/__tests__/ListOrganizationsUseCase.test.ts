import { MemberCount } from '@/domain/organization/OrganizationValues';
import { ResultCount } from '@/domain/shared/Pagination';
import { FirstName, LastName, MiddleName } from '@/domain/user/UserValues';
import { UserId } from '../../../domain/shared/EntityIds';
import { OrganizationName } from '../../../domain/organization/OrganizationValues';
import { OrganizationId } from '../../../domain/shared/EntityIds';
import { createOrganization } from '../../../domain/organization/__tests__/organizationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { ListOrganizationsUseCase } from '../ListOrganizationsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import {
  OrganizationRepository,
  OrganizationSearchFilters,
  OrganizationWithStats,
} from '../../../domain/organization/OrganizationRepository';

// Mock repository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private stats: Map<
    string,
    {
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
    }
  > = new Map();
  private userMemberships: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>

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
    const memberships = this.userMemberships.get(userId);

    return memberships ? memberships.has(organizationId) : false;
  }

  async isUserAdmin(
    userId: string,
    organizationId: string
  ): ReturnType<OrganizationRepository['isUserAdmin']> {
    return false;
  }

  async findMembershipsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findMembershipsByUserId']> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): ReturnType<OrganizationRepository['findAdminOrganizationsByUserId']> {
    return [];
  }

  async findAllWithStats(
    excludeUserMemberships?: string
  ): ReturnType<OrganizationRepository['findAllWithStats']> {
    const result: OrganizationWithStats[] = [];

    for (const org of this.organizations.values()) {
      // Skip organizations where user is already member or has pending request
      if (excludeUserMemberships) {
        const memberships = this.userMemberships.get(excludeUserMemberships);

        if (memberships && memberships.has(org.id)) {
          continue;
        }
      }

      const orgStats = this.stats.get(org.id) || {
        memberCount: 0,
        firstAdmin: null,
      };

      let parentOrg: OrganizationWithStats['parentOrg'] = null;

      if (org.parentId) {
        const parent = this.organizations.get(org.parentId);

        if (parent) {
          parentOrg = { id: parent.id, name: parent.name };
        }
      }

      result.push({
        organization: org,
        memberCount: MemberCount.parse(orgStats.memberCount),
        firstAdmin: orgStats.firstAdmin
          ? {
              id: UserId.parse(orgStats.firstAdmin.id),
              firstName: FirstName.parse(orgStats.firstAdmin.firstName),
              lastName: LastName.parse(orgStats.firstAdmin.lastName),
              middleName:
                orgStats.firstAdmin.middleName === null
                  ? null
                  : MiddleName.parse(orgStats.firstAdmin.middleName),
            }
          : null,
        parentOrg,
      });
    }

    return result;
  }

  async searchOrganizationsWithStats(
    filters: OrganizationSearchFilters,
    excludeUserMemberships?: string
  ): ReturnType<OrganizationRepository['searchOrganizationsWithStats']> {
    let result: OrganizationWithStats[] = [];

    for (const org of this.organizations.values()) {
      if (excludeUserMemberships) {
        const memberships = this.userMemberships.get(excludeUserMemberships);

        if (memberships && memberships.has(org.id)) {
          continue;
        }
      }

      const orgStats = this.stats.get(org.id) || {
        memberCount: 0,
        firstAdmin: null,
      };

      let parentOrg: OrganizationWithStats['parentOrg'] = null;

      if (org.parentId) {
        const parent = this.organizations.get(org.parentId);

        if (parent) {
          parentOrg = { id: parent.id, name: parent.name };
        }
      }

      // Search filter: name, description, parent org name
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const matchesName = org.name.toLowerCase().includes(term);
        const matchesDesc = org.description.toLowerCase().includes(term);
        const matchesParent = parentOrg?.name.toLowerCase().includes(term);

        if (!matchesName && !matchesDesc && !matchesParent) {
          continue;
        }
      }

      result.push({
        organization: org,
        memberCount: MemberCount.parse(orgStats.memberCount),
        firstAdmin: orgStats.firstAdmin
          ? {
              id: UserId.parse(orgStats.firstAdmin.id),
              firstName: FirstName.parse(orgStats.firstAdmin.firstName),
              lastName: LastName.parse(orgStats.firstAdmin.lastName),
              middleName:
                orgStats.firstAdmin.middleName === null
                  ? null
                  : MiddleName.parse(orgStats.firstAdmin.middleName),
            }
          : null,
        parentOrg,
      });
    }

    const totalCount = ResultCount.parse(result.length);

    // Pagination
    if (filters.page && filters.pageSize) {
      const start = (filters.page - 1) * filters.pageSize;
      result = result.slice(start, start + filters.pageSize);
    }

    return { organizations: result, totalCount };
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

  setStats(
    orgId: string,
    stats: {
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
    }
  ) {
    this.stats.set(orgId, stats);
  }

  addUserMembership(userId: string, orgId: string) {
    if (!this.userMemberships.has(userId)) {
      this.userMemberships.set(userId, new Set());
    }

    this.userMemberships.get(userId)!.add(orgId);
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

describe('ListOrganizationsUseCase', () => {
  let useCase: ListOrganizationsUseCase;
  let organizationRepository: MockOrganizationRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    useCase = new ListOrganizationsUseCase({
      organizationRepository,
    });
  });

  it('should return an empty list when no organizations exist', async () => {
    const result = await useCase.execute({});

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizations).toEqual([]);
      expect(result.value.totalCount).toBe(0);
    }
  });

  it('should return a list of organizations', async () => {
    // Create organizations
    const org1Result = createOrganization(
      'Organization 1',
      'Description 1',
      'creator-123'
    );
    const org2Result = createOrganization(
      'Organization 2',
      'Description 2',
      'creator-456'
    );

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;

      (org1 as any).props.id = 'org-1';
      (org2 as any).props.id = 'org-2';

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);

      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
        expect(result.value.totalCount).toBe(2);
        expect(result.value.organizations[0].organization.name).toBe(
          'Organization 1'
        );
        expect(result.value.organizations[1].organization.name).toBe(
          'Organization 2'
        );
      }
    }
  });

  it('should return organizations with member counts', async () => {
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 5,
        firstAdmin: null,
      });

      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].memberCount).toBe(5);
      }
    }
  });

  it('should return organizations with first admin information', async () => {
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 10,
        firstAdmin: {
          id: 'admin-1',
          firstName: 'John',
          lastName: 'Doe',
          middleName: null,
        },
      });

      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].firstAdmin).toEqual({
          id: 'admin-1',
          firstName: 'John',
          lastName: 'Doe',
          middleName: null,
        });
      }
    }
  });

  it('should handle organizations with no admin', async () => {
    const orgResult = createOrganization(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = Organization.reconstitute({
        ...orgResult.value.toJSON(),
        id: 'org-123',
      });

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 0,
        firstAdmin: null,
      });

      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].firstAdmin).toBeNull();
      }
    }
  });

  it('should return multiple organizations with different stats', async () => {
    // Create multiple organizations
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

      organizationRepository.setStats('org-1', {
        memberCount: 5,
        firstAdmin: {
          id: 'admin-1',
          firstName: 'Alice',
          lastName: 'Smith',
          middleName: null,
        },
      });

      organizationRepository.setStats('org-2', {
        memberCount: 10,
        firstAdmin: {
          id: 'admin-2',
          firstName: 'Bob',
          lastName: 'Johnson',
          middleName: null,
        },
      });

      organizationRepository.setStats('org-3', {
        memberCount: 0,
        firstAdmin: null,
      });

      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(3);

        const org1Data = result.value.organizations.find(
          (item) => item.organization.id === 'org-1'
        );
        const org2Data = result.value.organizations.find(
          (item) => item.organization.id === 'org-2'
        );
        const org3Data = result.value.organizations.find(
          (item) => item.organization.id === 'org-3'
        );

        expect(org1Data?.memberCount).toBe(5);
        expect(org1Data?.firstAdmin?.firstName).toBe('Alice');

        expect(org2Data?.memberCount).toBe(10);
        expect(org2Data?.firstAdmin?.firstName).toBe('Bob');

        expect(org3Data?.memberCount).toBe(0);
        expect(org3Data?.firstAdmin).toBeNull();
      }
    }
  });

  it('should exclude organizations where user is already a member', async () => {
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

      // User is a member of org-1 and has pending request for org-2
      organizationRepository.addUserMembership('user-123', 'org-1');
      organizationRepository.addUserMembership('user-123', 'org-2');

      const result = await useCase.execute({}, 'user-123');

      expect(result.success).toBe(true);

      if (result.success) {
        // Should only return org-3
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].organization.id).toBe('org-3');
      }
    }
  });

  it('should return all organizations when no userId is provided', async () => {
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

      // User is a member of org-1
      organizationRepository.addUserMembership('user-123', 'org-1');

      // Without userId, should return all organizations
      const result = await useCase.execute({});

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
      }
    }
  });

  it('should return paginated results', async () => {
    // Create 5 organizations
    for (let i = 1; i <= 5; i++) {
      const orgResult = createOrganization(`Org ${i}`, `Desc ${i}`, 'creator');
      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        (orgResult.value as any).props.id = `org-${i}`;
        organizationRepository.addOrganization(orgResult.value);
      }
    }

    const result = await useCase.execute({ page: 1, pageSize: 2 });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizations).toHaveLength(2);
      expect(result.value.totalCount).toBe(5);
    }
  });

  it('should return second page of results', async () => {
    for (let i = 1; i <= 5; i++) {
      const orgResult = createOrganization(`Org ${i}`, `Desc ${i}`, 'creator');
      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        (orgResult.value as any).props.id = `org-${i}`;
        organizationRepository.addOrganization(orgResult.value);
      }
    }

    const result = await useCase.execute({ page: 2, pageSize: 2 });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizations).toHaveLength(2);
      expect(result.value.totalCount).toBe(5);
    }
  });

  it('should filter by search term on name', async () => {
    const org1Result = createOrganization(
      'Environmental Group',
      'Desc 1',
      'creator'
    );
    const org2Result = createOrganization('Tech Alliance', 'Desc 2', 'creator');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      (org1Result.value as any).props.id = 'org-1';
      (org2Result.value as any).props.id = 'org-2';
      organizationRepository.addOrganization(org1Result.value);
      organizationRepository.addOrganization(org2Result.value);

      const result = await useCase.execute({ search: 'environ' });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].organization.name).toBe(
          'Environmental Group'
        );
        expect(result.value.totalCount).toBe(1);
      }
    }
  });

  it('should filter by search term on description', async () => {
    const org1Result = createOrganization(
      'Org A',
      'Protecting wildlife',
      'creator'
    );
    const org2Result = createOrganization(
      'Org B',
      'Building software',
      'creator'
    );

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      (org1Result.value as any).props.id = 'org-1';
      (org2Result.value as any).props.id = 'org-2';
      organizationRepository.addOrganization(org1Result.value);
      organizationRepository.addOrganization(org2Result.value);

      const result = await useCase.execute({ search: 'wildlife' });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].organization.name).toBe('Org A');
      }
    }
  });

  it('should combine search with pagination', async () => {
    // Create 5 orgs matching search, 2 not matching
    for (let i = 1; i <= 5; i++) {
      const orgResult = createOrganization(
        `Green Org ${i}`,
        `Green desc ${i}`,
        'creator'
      );
      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        (orgResult.value as any).props.id = `org-green-${i}`;
        organizationRepository.addOrganization(orgResult.value);
      }
    }

    for (let i = 1; i <= 2; i++) {
      const orgResult = createOrganization(
        `Other ${i}`,
        `Other desc ${i}`,
        'creator'
      );
      expect(orgResult.success).toBe(true);

      if (orgResult.success) {
        (orgResult.value as any).props.id = `org-other-${i}`;
        organizationRepository.addOrganization(orgResult.value);
      }
    }

    const result = await useCase.execute({
      search: 'green',
      page: 1,
      pageSize: 3,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organizations).toHaveLength(3);
      expect(result.value.totalCount).toBe(5);
    }
  });

  it('should search case-insensitively', async () => {
    const orgResult = createOrganization(
      'Democracy Foundation',
      'Civic engagement',
      'creator'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      (orgResult.value as any).props.id = 'org-1';
      organizationRepository.addOrganization(orgResult.value);

      const result = await useCase.execute({ search: 'DEMOCRACY' });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
      }
    }
  });
});
