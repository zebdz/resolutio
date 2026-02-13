import { describe, it, expect, beforeEach } from 'vitest';
import { GetUnreadNotificationCountUseCase } from '../GetUnreadNotificationCountUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private unreadCounts: Map<string, number> = new Map();

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
  async getUnreadCount(userId: string): Promise<number> {
    return this.unreadCounts.get(userId) || 0;
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

  setUnreadCount(userId: string, count: number) {
    this.unreadCounts.set(userId, count);
  }
}

describe('GetUnreadNotificationCountUseCase', () => {
  let useCase: GetUnreadNotificationCountUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new GetUnreadNotificationCountUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should return unread count', async () => {
    notifRepo.setUnreadCount('user-1', 5);

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.count).toBe(5);
    }
  });

  it('should return 0 when no unread notifications', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.count).toBe(0);
    }
  });
});
