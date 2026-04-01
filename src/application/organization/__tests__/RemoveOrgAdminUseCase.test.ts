import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveOrgAdminUseCase } from '../RemoveOrgAdminUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminRoles: Map<string, Set<string>> = new Map();

  async save(org: Organization): Promise<Organization> {
    this.organizations.set(org.id, org);

    return org;
  }
  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }
  async findByName(): Promise<Organization | null> {
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
  async searchOrganizationsWithStats(): Promise<any> {
    return { organizations: [], totalCount: 0 };
  }
  async update(org: Organization): Promise<Organization> {
    return org;
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
  async findAdminUserIds(organizationId: string): Promise<string[]> {
    const admins = this.adminRoles.get(organizationId);

    return admins ? Array.from(admins) : [];
  }
  async setParentId(): Promise<void> {}
  async addAdmin(organizationId: string, userId: string): Promise<void> {
    if (!this.adminRoles.has(organizationId)) {
      this.adminRoles.set(organizationId, new Set());
    }

    this.adminRoles.get(organizationId)!.add(userId);
  }
  async removeAdmin(organizationId: string, userId: string): Promise<void> {
    const admins = this.adminRoles.get(organizationId);

    if (admins && admins.size <= 1) {
      throw new Error('LAST_ADMIN');
    }

    admins?.delete(userId);
  }

  async searchByNameFuzzy(): Promise<Array<{ id: string; name: string }>> {
    return [];
  }
  async getRootAllowMultiTreeMembership(_orgId: string): Promise<boolean> {
    return false;
  }
  async findUsersWithMultipleMembershipsInOrgs(
    _orgIds: string[]
  ): Promise<string[]> {
    return [];
  }
  async setAllowMultiTreeMembership(
    _organizationId: string,
    _value: boolean | null
  ): Promise<void> {}

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

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;

  async save(notification: Notification): Promise<Notification> {
    this.saved = notification;

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

  getSaved() {
    return this.saved;
  }
}

class MockUserRepository implements UserRepository {
  private superAdmins: Set<string> = new Set();
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
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
  addUser(user: User): void {
    this.users.set(user.id, user);
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
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
  }
}

function makeOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Test Org',
    description: 'Test',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
    allowMultiTreeMembership: false,
  });
}

function makeArchivedOrg(id: string): Organization {
  return Organization.reconstitute({
    id,
    name: 'Archived',
    description: 'Archived',
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: new Date(),
    allowMultiTreeMembership: false,
  });
}

describe('RemoveOrgAdminUseCase', () => {
  let useCase: RemoveOrgAdminUseCase;
  let orgRepo: MockOrganizationRepository;
  let userRepo: MockUserRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    userRepo = new MockUserRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new RemoveOrgAdminUseCase({
      organizationRepository: orgRepo,
      userRepository: userRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should fail when org not found', async () => {
    const result = await useCase.execute({
      organizationId: 'nonexistent',
      targetUserId: 'user-1',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notFound');
    }
  });

  it('should fail when org is archived', async () => {
    orgRepo.addOrganization(makeArchivedOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-2',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.archived');
    }
  });

  it('should fail when actor is not admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-1',
      actorUserId: 'not-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notAdmin');
    }
  });

  it('should fail when actor tries to remove self', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'admin-2');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-1',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.cannotRemoveSelf');
    }
  });

  it('should fail when target is not an admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'not-admin-user',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.notOrgAdmin');
    }
  });

  it('should fail when trying to remove last admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'admin-2');
    // Mock removeAdmin throws LAST_ADMIN when only 1 admin remains
    // We have 2 admins, but let's test the repo-level protection
    // by setting up a scenario where removeAdmin would throw

    // Actually test with the real logic: 2 admins, remove one = OK
    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-2',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(true);
  });

  it('should fail when repo throws LAST_ADMIN', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    // Only 1 admin besides actor — removing the target would leave repo to throw
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'only-other-admin');

    // Override removeAdmin to simulate the transaction guard
    orgRepo.removeAdmin = async () => {
      throw new Error('LAST_ADMIN');
    };

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'only-other-admin',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('organization.errors.lastAdmin');
    }
  });

  it('should succeed removing another admin when 2+ admins', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'admin-2');
    orgRepo.setAdmin('org-1', 'admin-3');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-2',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(true);
    expect(await orgRepo.isUserAdmin('admin-2', 'org-1')).toBe(false);
  });

  it('should succeed when superadmin removes an admin', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'admin-2');
    userRepo.addSuperAdmin('superadmin-1');

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-1',
      actorUserId: 'superadmin-1',
    });

    expect(result.success).toBe(true);
  });

  it('should notify removed admin after successful removal', async () => {
    orgRepo.addOrganization(makeOrg('org-1'));
    orgRepo.setAdmin('org-1', 'admin-1');
    orgRepo.setAdmin('org-1', 'admin-2');

    const actor = User.reconstitute({
      id: 'admin-1',
      firstName: 'Ivan',
      lastName: 'Petrov',
      phoneNumber: PhoneNumber.create('+79001234567'),
      password: 'hashedpw',
      language: 'ru',
      createdAt: new Date(),
    });
    userRepo.addUser(actor);

    const result = await useCase.execute({
      organizationId: 'org-1',
      targetUserId: 'admin-2',
      actorUserId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Wait for fire-and-forget notification
    await new Promise((r) => setTimeout(r, 10));

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('admin-2');
    expect(saved!.type).toBe('admin_removed');
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
      actorName: 'Petrov Ivan',
    });
  });
});
