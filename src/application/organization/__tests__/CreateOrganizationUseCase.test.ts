import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganizationUseCase } from '../CreateOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '@/src/domain/organization/OrganizationDomainCodes';

// Mock repositories
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Organization[] = [];

  async save(organization: Organization): Promise<Organization> {
    (organization as any).props.id = `org-${Date.now()}`;
    this.organizations.push(organization);

    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.find((org) => org.id === id) || null;
  }

  async findByName(name: string): Promise<Organization | null> {
    return this.organizations.find((org) => org.name === name) || null;
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return this.organizations.filter((org) => org.createdById === creatorId);
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
    return this.organizations.filter((org) => org.parentId === parentId);
  }

  async getAncestorIds(organizationId: string): Promise<string[]> {
    const org = await this.findById(organizationId);

    if (!org || !org.parentId) {
      return [];
    }

    const ancestors: string[] = [org.parentId];
    const parentAncestors = await this.getAncestorIds(org.parentId);

    return [...ancestors, ...parentAncestors];
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
    const children = await this.findByParentId(organizationId);
    const descendants: string[] = children.map((c) => c.id);

    for (const child of children) {
      const childDescendants = await this.getDescendantIds(child.id);
      descendants.push(...childDescendants);
    }

    return descendants;
  }

  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    return false;
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

  async findAllWithStats(): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    return this.organizations.map((org) => ({
      organization: org,
      memberCount: 0,
      firstAdmin: null,
    }));
  }

  async update(organization: Organization): Promise<Organization> {
    const index = this.organizations.findIndex(
      (org) => org.id === organization.id
    );

    if (index !== -1) {
      this.organizations[index] = organization;
    }

    return organization;
  }
}

describe('CreateOrganizationUseCase', () => {
  let useCase: CreateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    useCase = new CreateOrganizationUseCase({
      organizationRepository,
    });
  });

  it('should create a new organization successfully', async () => {
    const input = {
      name: 'Test Organization',
      description: 'A test organization',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organization.name).toBe('Test Organization');
      expect(result.value.organization.description).toBe('A test organization');
      expect(result.value.organization.createdById).toBe('user-123');
      expect(result.value.organization.id).toBeTruthy();
    }
  });

  it('should fail if organization name is empty', async () => {
    const input = {
      name: '',
      description: 'This is a test organization',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }
  });

  it('should fail if organization description is empty', async () => {
    const input = {
      name: 'Test Organization',
      description: '',
      parentId: null,
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }
  });

  it('should fail if parent organization does not exist', async () => {
    const input = {
      name: 'Child Organization',
      description: 'This is a child organization',
      parentId: 'non-existent-org',
    };

    const result = await useCase.execute(input, 'user-123');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationErrors.PARENT_NOT_FOUND);
    }
  });

  it('should create a child organization under a valid parent', async () => {
    // First create a parent organization
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;

      // Now create a child organization
      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'user-456');

      expect(childResult.success).toBe(true);

      if (childResult.success) {
        expect(childResult.value.organization.parentId).toBe(parentId);
      }
    }
  });
});
