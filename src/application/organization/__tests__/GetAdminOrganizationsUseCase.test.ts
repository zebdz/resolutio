import { describe, it, expect, beforeEach } from 'vitest';
import { GetAdminOrganizationsUseCase } from '../GetAdminOrganizationsUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';

// Mock repository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map(); // userId -> Set<orgId>

  async save(organization: Organization): Promise<Organization> {
    (organization as any).props.id = `org-${Date.now()}`;
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
    return false;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const adminOrgs = this.adminRoles.get(userId);

    return adminOrgs ? adminOrgs.has(organizationId) : false;
  }

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(excludeUserMemberships?: string): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
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

  async update(organization: Organization): Promise<Organization> {
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
    const org1Result = Organization.create('Org 1', 'Desc 1', 'creator-1');
    const org2Result = Organization.create('Org 2', 'Desc 2', 'creator-2');

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
