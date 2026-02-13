import { describe, it, expect, beforeEach } from 'vitest';
import { GetNotificationsUseCase } from '../GetNotificationsUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private notifications: Notification[] = [];
  private unreadCounts: Map<string, number> = new Map();

  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(): Promise<Notification | null> {
    return null;
  }
  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Notification[]> {
    let results = this.notifications.filter((n) => n.userId === userId);

    if (options?.offset) {
      results = results.slice(options.offset);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }
  async getUnreadCount(userId: string): Promise<number> {
    return this.unreadCounts.get(userId) || 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(userId: string): Promise<number> {
    return this.notifications.filter((n) => n.userId === userId).length;
  }

  // Test helpers
  addNotification(notification: Notification) {
    this.notifications.push(notification);
  }
  setUnreadCount(userId: string, count: number) {
    this.unreadCounts.set(userId, count);
  }
}

function createNotification(
  userId: string,
  id: string = 'notif-1'
): Notification {
  return Notification.reconstitute({
    id,
    userId,
    type: 'org_joined_parent',
    title: 'notification.types.orgJoinedParent.title',
    body: 'notification.types.orgJoinedParent.body',
    data: null,
    readAt: null,
    createdAt: new Date(),
  });
}

describe('GetNotificationsUseCase', () => {
  let useCase: GetNotificationsUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new GetNotificationsUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should return notifications, unread count and total count for user', async () => {
    notifRepo.addNotification(createNotification('user-1', 'n-1'));
    notifRepo.addNotification(createNotification('user-1', 'n-2'));
    notifRepo.setUnreadCount('user-1', 2);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.notifications).toHaveLength(2);
      expect(result.value.unreadCount).toBe(2);
      expect(result.value.totalCount).toBe(2);
    }
  });

  it('should pass limit and offset to repository', async () => {
    notifRepo.addNotification(createNotification('user-1', 'n-1'));
    notifRepo.addNotification(createNotification('user-1', 'n-2'));
    notifRepo.addNotification(createNotification('user-1', 'n-3'));
    notifRepo.setUnreadCount('user-1', 1);

    const result = await useCase.execute({
      userId: 'user-1',
      limit: 2,
      offset: 1,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.notifications).toHaveLength(2);
    }
  });

  it('should return empty list when no notifications', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.notifications).toHaveLength(0);
      expect(result.value.unreadCount).toBe(0);
      expect(result.value.totalCount).toBe(0);
    }
  });
});
