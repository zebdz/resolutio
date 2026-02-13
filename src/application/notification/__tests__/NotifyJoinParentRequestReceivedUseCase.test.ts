import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyJoinParentRequestReceivedUseCase } from '../NotifyJoinParentRequestReceivedUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private adminUserIds: Map<string, string[]> = new Map();

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
  async setParentId(): Promise<void> {}
  async findAdminUserIds(organizationId: string): Promise<string[]> {
    return this.adminUserIds.get(organizationId) || [];
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
  setAdminUserIds(orgId: string, userIds: string[]) {
    this.adminUserIds.set(orgId, userIds);
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

describe('NotifyJoinParentRequestReceivedUseCase', () => {
  let useCase: NotifyJoinParentRequestReceivedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyJoinParentRequestReceivedUseCase({
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should notify all admins of parent org', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setAdminUserIds('parent-1', ['admin-1', 'admin-2']);

    await useCase.execute({ childOrgId: 'child-1', parentOrgId: 'parent-1' });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(2);

    for (const notification of saved) {
      expect(notification.type).toBe('join_parent_request_received');
      expect(notification.title).toBe(
        'notification.types.joinParentRequestReceived.title'
      );
      expect(notification.body).toBe(
        'notification.types.joinParentRequestReceived.body'
      );
      expect(notification.data).toEqual({
        childOrgId: 'child-1',
        parentOrgId: 'parent-1',
        childOrgName: 'Child Org',
        parentOrgName: 'Parent Org',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('admin-1');
    expect(userIds).toContain('admin-2');
  });

  it('should not create notifications when no admins', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(childOrg);
    orgRepo.addOrganization(parentOrg);
    orgRepo.setAdminUserIds('parent-1', []);

    await useCase.execute({ childOrgId: 'child-1', parentOrgId: 'parent-1' });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing child org gracefully', async () => {
    const parentOrg = createOrg('parent-1', 'Parent Org');
    orgRepo.addOrganization(parentOrg);
    orgRepo.setAdminUserIds('parent-1', ['admin-1']);

    await useCase.execute({
      childOrgId: 'nonexistent',
      parentOrgId: 'parent-1',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle missing parent org gracefully', async () => {
    const childOrg = createOrg('child-1', 'Child Org');
    orgRepo.addOrganization(childOrg);

    await useCase.execute({
      childOrgId: 'child-1',
      parentOrgId: 'nonexistent',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
