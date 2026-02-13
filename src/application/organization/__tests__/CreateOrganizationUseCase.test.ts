import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganizationUseCase } from '../CreateOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '@/domain/organization/OrganizationDomainCodes';

// Mock repositories
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Organization[] = [];
  private admins: Map<string, Set<string>> = new Map();

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
    const admins = this.admins.get(organizationId);

    return admins ? admins.has(userId) : false;
  }

  addAdmin(organizationId: string, userId: string): void {
    if (!this.admins.has(organizationId)) {
      this.admins.set(organizationId, new Set());
    }

    this.admins.get(organizationId)!.add(userId);
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

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();

  async findById(id: string): Promise<User | null> {
    return null;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    return [];
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    return null;
  }

  async save(user: User): Promise<User> {
    return user;
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    return false;
  }

  async searchUsers(query: string): Promise<User[]> {
    return [];
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }
}

describe('CreateOrganizationUseCase', () => {
  let useCase: CreateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    useCase = new CreateOrganizationUseCase({
      organizationRepository,
      userRepository,
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

  it('should create a child organization under a valid parent when user is admin', async () => {
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
      organizationRepository.addAdmin(parentId, 'admin-user');

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'admin-user');

      expect(childResult.success).toBe(true);

      if (childResult.success) {
        expect(childResult.value.organization.parentId).toBe(parentId);
      }
    }
  });

  it('should fail to create child organization when user is not admin of parent', async () => {
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'non-admin-user');

      expect(childResult.success).toBe(false);

      if (!childResult.success) {
        expect(childResult.error).toBe(OrganizationErrors.NOT_ADMIN);
      }
    }
  });

  it('should allow superadmin to create child organization without being org admin', async () => {
    const parentInput = {
      name: 'Parent Organization',
      description: 'This is a parent organization',
      parentId: null,
    };

    const parentResult = await useCase.execute(parentInput, 'user-123');
    expect(parentResult.success).toBe(true);

    if (parentResult.success) {
      const parentId = parentResult.value.organization.id;
      userRepository.addSuperAdmin('superadmin-1');

      const childInput = {
        name: 'Child Organization',
        description: 'This is a child organization',
        parentId,
      };

      const childResult = await useCase.execute(childInput, 'superadmin-1');

      expect(childResult.success).toBe(true);

      if (childResult.success) {
        expect(childResult.value.organization.parentId).toBe(parentId);
      }
    }
  });
});
