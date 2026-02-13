import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyOrgJoinedParentUseCase } from '../NotifyOrgJoinedParentUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private memberUserIds: Map<string, string[]> = new Map();

  async save(org: Organization): Promise<Organization> {
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
  async isUserMember(): Promise<boolean> {
    return false;
  }
  async isUserAdmin(): Promise<boolean> {
    return false;
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
  async update(org: Organization): Promise<Organization> {
    return org;
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
  async setParentId(): Promise<void> {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
  setMemberUserIds(orgId: string, userIds: string[]) {
    this.memberUserIds.set(orgId, userIds);
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

function createOrg(id: string, name: string): Organization {
  return Organization.reconstitute({
    id,
    name,
    description: `${name} desc`,
    parentId: null,
    createdById: 'creator-1',
    createdAt: new Date(),
    archivedAt: null,
  });
}

describe('NotifyOrgJoinedParentUseCase', () => {
  let useCase: NotifyOrgJoinedParentUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyOrgJoinedParentUseCase({
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should create notifications for all members of child org', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', ['user-1', 'user-2', 'user-3']);

    await useCase.execute({ childOrgId: 'child-1', parentOrgId: 'parent-1' });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(3);

    for (const notification of saved) {
      expect(notification.type).toBe('org_joined_parent');
      expect(notification.title).toBe(
        'notification.types.orgJoinedParent.title'
      );
      expect(notification.body).toBe('notification.types.orgJoinedParent.body');
      expect(notification.data).toEqual({
        childOrgId: 'child-1',
        parentOrgId: 'parent-1',
        childOrgName: 'Child Org',
        parentOrgName: 'Parent Org',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('user-3');
  });

  it('should not create notifications when no members', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setMemberUserIds('child-1', []);

    await useCase.execute({ childOrgId: 'child-1', parentOrgId: 'parent-1' });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing child org gracefully', async () => {
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(parentOrg);

    // Should not throw
    await useCase.execute({
      childOrgId: 'nonexistent',
      parentOrgId: 'parent-1',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing parent org gracefully', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.setMemberUserIds('child-1', ['user-1']);

    // Should not throw
    await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'nonexistent',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
