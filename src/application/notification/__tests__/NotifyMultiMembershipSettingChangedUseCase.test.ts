import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotifyMultiMembershipSettingChangedUseCase } from '../NotifyMultiMembershipSettingChangedUseCase';
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

describe('NotifyMultiMembershipSettingChangedUseCase', () => {
  let useCase: NotifyMultiMembershipSettingChangedUseCase;
  let orgRepo: MockOrganizationRepository;
  let notificationRepo: MockNotificationRepository;

  beforeEach(() => {
    orgRepo = new MockOrganizationRepository();
    notificationRepo = new MockNotificationRepository();
    useCase = new NotifyMultiMembershipSettingChangedUseCase({
      organizationRepository: orgRepo as unknown as OrganizationRepository,
      notificationRepository:
        notificationRepo as unknown as NotificationRepository,
    });
  });

  it('should send notification to all tree members when setting changes', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'root-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAcceptedMembers('root-1', ['user-1', 'user-2']);

    await useCase.execute({ rootOrgId: 'root-1', allowed: true });

    const saved = notificationRepo.getSaved();
    expect(saved).toHaveLength(2);
    expect(saved[0].type).toBe('multi_membership_setting_changed');
    expect(saved[0].data).toEqual({
      organizationId: 'root-1',
      organizationName: 'Root Org',
      allowed: true,
    });
    expect(saved.map((n) => n.userId).sort()).toEqual(['user-1', 'user-2']);
  });

  it('should not send notifications when org has no members', async () => {
    const rootOrg = Organization.reconstitute({
      id: 'root-1',
      name: 'Root Org',
      description: 'desc',
      parentId: null,
      createdById: 'creator-1',
      createdAt: new Date(),
      archivedAt: null,
      allowMultiTreeMembership: true,
    });
    orgRepo.addOrganization(rootOrg);
    orgRepo.setAcceptedMembers('root-1', []);

    await useCase.execute({ rootOrgId: 'root-1', allowed: true });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });

  it('should not send notifications when org not found', async () => {
    await useCase.execute({ rootOrgId: 'nonexistent', allowed: true });

    expect(notificationRepo.getSaved()).toHaveLength(0);
  });
});
