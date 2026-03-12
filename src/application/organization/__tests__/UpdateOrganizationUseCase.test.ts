import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateOrganizationUseCase } from '../UpdateOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();

  async save(organization: Organization): Promise<Organization> {
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
  async findByCreatorId(): Promise<Organization[]> {
    return [];
  }
  async findByParentId(): Promise<Organization[]> {
    return [];
  }
  async getAncestorIds(): Promise<string[]> {
    return [];
  }
  async getDescendantIds(): Promise<string[]> {
    return [];
  }
  async getFullTreeOrgIds(): Promise<string[]> {
    return [];
  }
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? admins.has(userId) : false;
  }
  async findMembershipsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAdminOrganizationsByUserId(): Promise<Organization[]> {
    return [];
  }
  async findAllWithStats(): Promise<any[]> {
    return [];
  }
  async searchOrganizationsWithStats(): Promise<{
    organizations: any[];
    totalCount: number;
  }> {
    return { organizations: [], totalCount: 0 };
  }
  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }
  async findAcceptedMemberUserIdsIncludingDescendants(): Promise<string[]> {
    return [];
  }
  async removeUserFromOrganization(): Promise<void> {}
  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }
  async getAncestors(): Promise<any[]> {
    return [];
  }
  async getChildrenWithStats(): Promise<any[]> {
    return [];
  }
  async getHierarchyTree(): Promise<any> {
    return {
      ancestors: [],
      tree: { id: '', name: '', memberCount: 0, children: [] },
    };
  }
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}
  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setAdmin(organizationId: string, userId: string): void {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();
  async findById(): Promise<User | null> {
    return null;
  }
  async findByIds(): Promise<User[]> {
    return [];
  }
  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }
  async save(user: User): Promise<User> {
    return user;
  }
  async exists(): Promise<boolean> {
    return false;
  }
  async searchUsers(): Promise<User[]> {
    return [];
  }
  async searchUserByPhone(_phone: string): Promise<User | null> {
    return null;
  }
  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async confirmUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
  }
}

function makeOrg(
  id: string,
  name: string = 'Test Org',
  description: string = 'Test description'
): Organization {
  const org = Organization.reconstitute({
    id,
    name,
    description,
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
  });

  return org;
}

function makeArchivedOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Archived Org',
    description: 'Archived',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
  });
}

describe('UpdateOrganizationUseCase', () => {
  let useCase: UpdateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    useCase = new UpdateOrganizationUseCase({
      organizationRepository,
      userRepository,
    });
  });

  it('should fail when org not found', async () => {
    const result = await useCase.execute({
      organizationId: 'nonexistent',
      userId: 'admin-1',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('should fail when org is archived', async () => {
    organizationRepository.addOrganization(makeArchivedOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.archived');
    }
  });

  it('should fail when user is not admin and not superadmin', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'regular-user',
      name: 'New Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('should fail when name is taken by another org', async () => {
    organizationRepository.addOrganization(makeOrg('org-1', 'Original Name'));
    organizationRepository.addOrganization(makeOrg('org-2', 'Taken Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Taken Name',
      description: 'Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.nameExists');
    }
  });

  it('should fail with domain error for empty name', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: '',
      description: 'Desc',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('domain.organization.organizationNameEmpty');
    }
  });

  it('should fail with domain error for empty description', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Valid Name',
      description: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        'domain.organization.organizationDescriptionEmpty'
      );
    }
  });

  it('should succeed when org admin updates', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Updated Name',
      description: 'Updated Desc',
    });

    expect(result.success).toBe(true);

    const updated = await organizationRepository.findById('org-1');
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('Updated Desc');
  });

  it('should succeed when superadmin updates', async () => {
    organizationRepository.addOrganization(makeOrg('org-1'));
    userRepository.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'superadmin-1',
      name: 'Updated Name',
      description: 'Updated Desc',
    });

    expect(result.success).toBe(true);

    const updated = await organizationRepository.findById('org-1');
    expect(updated!.name).toBe('Updated Name');
    expect(updated!.description).toBe('Updated Desc');
  });

  it('should skip uniqueness check when name is unchanged', async () => {
    organizationRepository.addOrganization(makeOrg('org-1', 'Same Name'));
    organizationRepository.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      userId: 'admin-1',
      name: 'Same Name',
      description: 'New Desc',
    });

    expect(result.success).toBe(true);
  });
});
