import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateOrganizationUseCase } from '../UpdateOrganizationUseCase';
import { OrganizationErrors } from '../OrganizationErrors';
import { NotifyOrgNameChangedUseCase } from '../../notification/NotifyOrgNameChangedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();
  private setAllowMultiTreeMembershipCalls: Array<{
    orgId: string;
    value: boolean | null;
  }> = [];
  private usersWithMultipleMemberships: string[] = [];

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
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): Promise<string[]> {
    return this.usersWithMultipleMemberships;
  }
  async setAllowMultiTreeMembership(
    organizationId: string,
    value: boolean | null
  ): Promise<void> {
    this.setAllowMultiTreeMembershipCalls.push({
      orgId: organizationId,
      value,
    });
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
  setUsersWithMultipleMemberships(userIds: string[]): void {
    this.usersWithMultipleMemberships = userIds;
  }
  getSetAllowMultiTreeMembershipCalls() {
    return this.setAllowMultiTreeMembershipCalls;
  }
}

class MockNotificationRepository implements NotificationRepository {
  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
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
    allowMultiTreeMembership: false,
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
    allowMultiTreeMembership: false,
  });
}

describe('UpdateOrganizationUseCase', () => {
  let useCase: UpdateOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let userRepository: MockUserRepository;
  let notificationRepository: MockNotificationRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    userRepository = new MockUserRepository();
    notificationRepository = new MockNotificationRepository();
    useCase = new UpdateOrganizationUseCase({
      organizationRepository,
      userRepository,
      notificationRepository,
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

  describe('allowMultiTreeMembership toggle', () => {
    it('should allow root org to enable multi-membership', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
        allowMultiTreeMembership: true,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toContainEqual({ orgId: 'org-1', value: true });
    });

    it('should reject toggle on child org with NOT_ROOT_ORG', async () => {
      const childOrg = Organization.reconstitute({
        id: 'org-child',
        name: 'Child Org',
        description: 'desc',
        parentId: 'org-parent',
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: null,
      });
      organizationRepository.addOrganization(childOrg);
      organizationRepository.setAdmin('org-child', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-child',
        userId: 'admin-1',
        name: 'Child Org',
        description: 'desc',
        allowMultiTreeMembership: true,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(OrganizationErrors.NOT_ROOT_ORG);
      }
    });

    it('should reject disabling when users have multiple memberships', async () => {
      const rootOrg = Organization.reconstitute({
        id: 'org-1',
        name: 'Root Org',
        description: 'desc',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: true,
      });
      organizationRepository.addOrganization(rootOrg);
      organizationRepository.setAdmin('org-1', 'admin-1');
      organizationRepository.setUsersWithMultipleMemberships(['user-1']);

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Root Org',
        description: 'desc',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationErrors.MULTI_MEMBERSHIP_CONFLICTS_EXIST
        );
      }
    });

    it('should allow disabling when no users have multiple memberships', async () => {
      const rootOrg = Organization.reconstitute({
        id: 'org-1',
        name: 'Root Org',
        description: 'desc',
        parentId: null,
        createdById: 'creator-1',
        createdAt: new Date(),
        archivedAt: null,
        allowMultiTreeMembership: true,
      });
      organizationRepository.addOrganization(rootOrg);
      organizationRepository.setAdmin('org-1', 'admin-1');
      organizationRepository.setUsersWithMultipleMemberships([]);

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Root Org',
        description: 'desc',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toContainEqual({ orgId: 'org-1', value: false });
    });

    it('should not call setAllowMultiTreeMembership when value unchanged', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
        allowMultiTreeMembership: false,
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toHaveLength(0);
    });

    it('should not change setting when allowMultiTreeMembership not in input', async () => {
      organizationRepository.addOrganization(makeOrg('org-1'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Test Org',
        description: 'Test description',
      });

      expect(result.success).toBe(true);
      expect(
        organizationRepository.getSetAllowMultiTreeMembershipCalls()
      ).toHaveLength(0);
    });
  });

  describe('org name change notification', () => {
    it('should fire notification when name changes', async () => {
      const executeSpy = vi
        .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
        .mockResolvedValue(undefined);

      organizationRepository.addOrganization(makeOrg('org-1', 'Old Name'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'New Name',
        description: 'Test description',
      });

      expect(result.success).toBe(true);
      expect(executeSpy).toHaveBeenCalledWith({
        organizationId: 'org-1',
        oldName: 'Old Name',
        newName: 'New Name',
      });

      executeSpy.mockRestore();
    });

    it('should not fire notification when name stays the same', async () => {
      const executeSpy = vi
        .spyOn(NotifyOrgNameChangedUseCase.prototype, 'execute')
        .mockResolvedValue(undefined);

      organizationRepository.addOrganization(makeOrg('org-1', 'Same Name'));
      organizationRepository.setAdmin('org-1', 'admin-1');

      const result = await useCase.execute({
        organizationId: 'org-1',
        userId: 'admin-1',
        name: 'Same Name',
        description: 'New description',
      });

      expect(result.success).toBe(true);
      expect(executeSpy).not.toHaveBeenCalled();

      executeSpy.mockRestore();
    });
  });
});
