import { describe, it, expect, beforeEach } from 'vitest';
import { ListOrganizationsUseCase } from '../ListOrganizationsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';

// Mock repository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private stats: Map<
    string,
    {
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }
  > = new Map();
  private userMemberships: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>

  async save(organization: Organization): Promise<Organization> {
    organization.setId(`org-${Date.now()}`);
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findByName(name: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.name === name) {
        return org;
      }
    }

    return null;
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.createdById === creatorId
    );
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
    return Array.from(this.organizations.values()).filter(
      (org) => org.parentId === parentId
    );
  }

  async getAncestorIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
    return [];
  }

  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    const memberships = this.userMemberships.get(userId);

    return memberships ? memberships.has(organizationId) : false;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    return false;
  }

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(excludeUserMemberships?: string): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    const result: Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }> = [];

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

      result.push({
        organization: org,
        memberCount: orgStats.memberCount,
        firstAdmin: orgStats.firstAdmin,
      });
    }

    return result;
  }

  async update(organization: Organization): Promise<Organization> {
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
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
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
    const result = await useCase.execute();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.organizations).toEqual([]);
    }
  });

  it('should return a list of organizations', async () => {
    // Create organizations
    const org1Result = Organization.create(
      'Organization 1',
      'Description 1',
      'creator-123'
    );
    const org2Result = Organization.create(
      'Organization 2',
      'Description 2',
      'creator-456'
    );

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;

      org1.setId('org-1');
      org2.setId('org-2');

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
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
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      org.setId('org-123');

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 5,
        firstAdmin: null,
      });

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].memberCount).toBe(5);
      }
    }
  });

  it('should return organizations with first admin information', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      org.setId('org-123');

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 10,
        firstAdmin: {
          id: 'admin-1',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].firstAdmin).toEqual({
          id: 'admin-1',
          firstName: 'John',
          lastName: 'Doe',
        });
      }
    }
  });

  it('should handle organizations with no admin', async () => {
    const orgResult = Organization.create(
      'Test Organization',
      'Test description',
      'creator-123'
    );
    expect(orgResult.success).toBe(true);

    if (orgResult.success) {
      const org = orgResult.value;
      org.setId('org-123');

      organizationRepository.addOrganization(org);
      organizationRepository.setStats('org-123', {
        memberCount: 0,
        firstAdmin: null,
      });

      const result = await useCase.execute();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].firstAdmin).toBeNull();
      }
    }
  });

  it('should return multiple organizations with different stats', async () => {
    // Create multiple organizations
    const org1Result = Organization.create('Org 1', 'Desc 1', 'creator-1');
    const org2Result = Organization.create('Org 2', 'Desc 2', 'creator-2');
    const org3Result = Organization.create('Org 3', 'Desc 3', 'creator-3');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);
    expect(org3Result.success).toBe(true);

    if (org1Result.success && org2Result.success && org3Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;
      const org3 = org3Result.value;

      org1.setId('org-1');
      org2.setId('org-2');
      org3.setId('org-3');

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);
      organizationRepository.addOrganization(org3);

      organizationRepository.setStats('org-1', {
        memberCount: 5,
        firstAdmin: { id: 'admin-1', firstName: 'Alice', lastName: 'Smith' },
      });

      organizationRepository.setStats('org-2', {
        memberCount: 10,
        firstAdmin: { id: 'admin-2', firstName: 'Bob', lastName: 'Johnson' },
      });

      organizationRepository.setStats('org-3', {
        memberCount: 0,
        firstAdmin: null,
      });

      const result = await useCase.execute();

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
    const org1Result = Organization.create('Org 1', 'Desc 1', 'creator-1');
    const org2Result = Organization.create('Org 2', 'Desc 2', 'creator-2');
    const org3Result = Organization.create('Org 3', 'Desc 3', 'creator-3');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);
    expect(org3Result.success).toBe(true);

    if (org1Result.success && org2Result.success && org3Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;
      const org3 = org3Result.value;

      org1.setId('org-1');
      org2.setId('org-2');
      org3.setId('org-3');

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);
      organizationRepository.addOrganization(org3);

      // User is a member of org-1 and has pending request for org-2
      organizationRepository.addUserMembership('user-123', 'org-1');
      organizationRepository.addUserMembership('user-123', 'org-2');

      const result = await useCase.execute('user-123');

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only return org-3
        expect(result.value.organizations).toHaveLength(1);
        expect(result.value.organizations[0].organization.id).toBe('org-3');
      }
    }
  });

  it('should return all organizations when no userId is provided', async () => {
    const org1Result = Organization.create('Org 1', 'Desc 1', 'creator-1');
    const org2Result = Organization.create('Org 2', 'Desc 2', 'creator-2');

    expect(org1Result.success).toBe(true);
    expect(org2Result.success).toBe(true);

    if (org1Result.success && org2Result.success) {
      const org1 = org1Result.value;
      const org2 = org2Result.value;

      org1.setId('org-1');
      org2.setId('org-2');

      organizationRepository.addOrganization(org1);
      organizationRepository.addOrganization(org2);

      // User is a member of org-1
      organizationRepository.addUserMembership('user-123', 'org-1');

      // Without userId, should return all organizations
      const result = await useCase.execute();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.organizations).toHaveLength(2);
      }
    }
  });
});
