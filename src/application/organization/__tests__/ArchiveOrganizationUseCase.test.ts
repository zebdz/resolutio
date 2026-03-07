import { describe, it, expect, beforeEach } from 'vitest';
import { ArchiveOrganizationUseCase } from '../ArchiveOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { UserRepository } from '../../../domain/user/UserRepository';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberUserIds: Map<string, string[]> = new Map();

  async save(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findByName(name: string): Promise<Organization | null> {
    return null;
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    return [];
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
    return [];
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

  async findAll(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async update(organization: Organization): Promise<Organization> {
    this.organizations.set(organization.id, organization);

    return organization;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    return false;
  }

  async findMembershipsByUserId(userId: string): Promise<any[]> {
    return [];
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    return [];
  }

  async findAllWithStats(): Promise<any[]> {
    return [];
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

  async searchOrganizationsWithStats(): Promise<{
    organizations: any[];
    totalCount: number;
  }> {
    return { organizations: [], totalCount: 0 };
  }

  async setParentId(
    organizationId: string,
    parentId: string | null
  ): Promise<void> {}

  async findAdminUserIds(): Promise<string[]> {
    return [];
  }

  async addAdmin(): Promise<void> {}
  async removeAdmin(): Promise<void> {}

  async getFullTreeOrgIds(): Promise<string[]> {
    return [];
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    organizationId: string
  ): Promise<string[]> {
    return this.memberUserIds.get(organizationId) || [];
  }

  async removeUserFromOrganization(): Promise<void> {}

  async findPendingRequestsByUserId(): Promise<Organization[]> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization): void {
    this.organizations.set(org.id, org);
  }
  setMemberUserIds(orgId: string, userIds: string[]) {
    this.memberUserIds.set(orgId, userIds);
  }

  clear(): void {
    this.organizations.clear();
  }
}

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private savedBatch: Notification[] = [];

  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(notifications: Notification[]): Promise<void> {
    this.savedBatch.push(...notifications);
  }
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

  // Test helpers
  getSavedBatch() {
    return this.savedBatch;
  }
}

// Mock UserRepository
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

  async searchUserByPhone(_phone: string): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }

  addSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  clear(): void {
    this.superAdmins.clear();
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}
}

describe('ArchiveOrganizationUseCase', () => {
  let useCase: ArchiveOrganizationUseCase;
  let organizationRepository: MockOrganizationRepository;
  let notificationRepository: MockNotificationRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    organizationRepository = new MockOrganizationRepository();
    notificationRepository = new MockNotificationRepository();
    userRepository = new MockUserRepository();
    useCase = new ArchiveOrganizationUseCase({
      organizationRepository,
      notificationRepository,
      userRepository,
    });
  });

  describe('when organization does not exist', () => {
    it('should return failure with NOT_FOUND error', async () => {
      const result = await useCase.execute({
        organizationId: 'non-existent-org',
        adminUserId: 'admin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notFound');
      }
    });
  });

  describe('when user is not a superadmin', () => {
    beforeEach(() => {
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
      }
    });

    it('should return failure with NOT_ADMIN error', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'regular-user',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('organization.errors.notAdmin');
      }
    });
  });

  describe('when organization is already archived', () => {
    beforeEach(() => {
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        org.archive();
        organizationRepository.addOrganization(org);
      }

      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should return failure with already archived error', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          'domain.organization.organizationAlreadyArchived'
        );
      }
    });
  });

  describe('when superadmin archives successfully', () => {
    beforeEach(() => {
      const orgResult = Organization.create(
        'Test Org',
        'Test Desc',
        'creator-1'
      );

      if (orgResult.success) {
        const org = orgResult.value;
        (org as any).props.id = 'org-1';
        organizationRepository.addOrganization(org);
      }

      userRepository.addSuperAdmin('superadmin-1');
    });

    it('should archive the organization', async () => {
      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      const archivedOrg = await organizationRepository.findById('org-1');
      expect(archivedOrg).not.toBeNull();
      expect(archivedOrg!.isArchived()).toBe(true);
      expect(archivedOrg!.archivedAt).not.toBeNull();
    });

    it('should notify members of org + descendants', async () => {
      organizationRepository.setMemberUserIds('org-1', ['user-1', 'user-2']);

      const result = await useCase.execute({
        organizationId: 'org-1',
        adminUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);

      const saved = notificationRepository.getSavedBatch();
      expect(saved).toHaveLength(2);
      expect(saved[0].type).toBe('org_archived');
      expect(saved.map((n) => n.userId)).toEqual(
        expect.arrayContaining(['user-1', 'user-2'])
      );
    });
  });
});
