import { describe, it, expect } from 'vitest';
import { NotifyMemberRemovedFromOrganizationUseCase } from '../NotifyMemberRemovedFromOrganizationUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

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

describe('NotifyMemberRemovedFromOrganizationUseCase', () => {
  it('saves a notification to the removed member with type and org data', async () => {
    const notifRepo = new MockNotificationRepository();
    const useCase = new NotifyMemberRemovedFromOrganizationUseCase({
      notificationRepository: notifRepo,
    });

    await useCase.execute({
      removedUserId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('user-1');
    expect(saved!.type).toBe('member_removed_from_organization');
    expect(saved!.title).toBe(
      'notification.types.memberRemovedFromOrganization.title'
    );
    expect(saved!.body).toBe(
      'notification.types.memberRemovedFromOrganization.body'
    );
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });
});
