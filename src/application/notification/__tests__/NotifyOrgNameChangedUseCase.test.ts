import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyOrgNameChangedUseCase } from '../NotifyOrgNameChangedUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockOrganizationRepository {
  private organizations: Map<string, Organization> = new Map();
  private membersByOrgId: Map<string, string[]> = new Map();

  async findById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) || null;
  }

  async findAcceptedMemberUserIdsIncludingDescendants(
    orgId: string
  ): Promise<string[]> {
    return this.membersByOrgId.get(orgId) || [];
  }

  addOrganization(org: Organization) {
    this.organizations.set(org.id, org);
  }

  setAcceptedMembers(orgId: string, userIds: string[]) {
    this.membersByOrgId.set(orgId, userIds);
  }
}

class MockNotificationRepository {
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

describe('NotifyOrgNameChangedUseCase', () => {
  let useCase: NotifyOrgNameChangedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notificationRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notificationRepo = new MockNotificationRepository();
    useCase = new NotifyOrgNameChangedUseCase({
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      notificationRepository:
        notificationRepo as unknown as NotificationRepository,
    });
  });

  it('should send notification to all members including descendants', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', ['user-1', 'user-2', 'user-3']);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    const saved = notificationRepo.getSaved();
    expect(saved).toHaveLength(3);
    expect(saved[0].type).toBe('org_name_changed');
    expect(saved[0].data).toEqual({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });
    expect(saved.map((n) => n.userId).sort()).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
  });

  it('should not send notifications when org has no members', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', []);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should not send notifications when org not found', async () => {
    await useCase.execute({
      organizationId: 'nonexistent',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should use correct notification title and body keys', async () => {
    const org = Organization.reconstitute({
      id: 'org-1',
      name: 'New Name',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: false,
    });
    orgRepo.addOrganization(org);
    orgRepo.setAcceptedMembers('org-1', ['user-1']);

    await useCase.execute({
      organizationId: 'org-1',
      oldName: 'Old Name',
      newName: 'New Name',
    });

    const saved = notificationRepo.getSaved();
    expect(saved[0].title).toBe('notification.types.orgNameChanged.title');
    expect(saved[0].body).toBe('notification.types.orgNameChanged.body');
  });
});
