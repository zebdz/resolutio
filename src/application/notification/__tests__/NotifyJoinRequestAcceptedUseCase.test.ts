import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyJoinRequestAcceptedUseCase } from '../NotifyJoinRequestAcceptedUseCase';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';
import { Organization } from '../../../domain/organization/Organization';

// Mock OrganizationRepository
class MockOrganizationRepository implements OrganizationRepository {
  private organizations: Map<string, Organization> = new Map();

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
  async searchOrganizationsWithStats(): Promise<{
    organizations: any[];
    totalCount: number;
  }> {
    return { organizations: [], totalCount: 0 };
  }
  async setParentId(): Promise<void> {}
  async findAdminUserIds(): Promise<string[]> {
    return [];
  }

  // Test helpers
  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }
}

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private saved: Notification[] = [];

  async save(notification: Notification): Promise<Notification> {
    this.saved.push(notification);

    return notification;
  }
  async saveBatch(notifications: Notification[]): Promise<void> {
    this.saved.push(...notifications);
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

  getSaved() {
    return this.saved;
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

describe('NotifyJoinRequestAcceptedUseCase', () => {
  let useCase: NotifyJoinRequestAcceptedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyJoinRequestAcceptedUseCase({
      organizationRepository: orgRepo,
      notificationRepository: notifRepo,
    });
  });

  it('should create notification for the requester', async () => {
    const org = createOrg('org-1', 'Test Org');
    orgRepo.addOrganization(org);

    await useCase.execute({
      organizationId: 'org-1',
      requesterUserId: 'user-1',
    });

    const saved = notifRepo.getSaved();
    expect(saved).toHaveLength(1);

    const notification = saved[0];
    expect(notification.userId).toBe('user-1');
    expect(notification.type).toBe('join_request_accepted');
    expect(notification.title).toBe(
      'notification.types.joinRequestAccepted.title'
    );
    expect(notification.body).toBe(
      'notification.types.joinRequestAccepted.body'
    );
    expect(notification.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });

  it('should handle missing organization gracefully', async () => {
    await useCase.execute({
      organizationId: 'nonexistent',
      requesterUserId: 'user-1',
    });

    expect(notifRepo.getSaved()).toHaveLength(0);
  });
});
