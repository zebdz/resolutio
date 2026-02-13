import { describe, it, expect, beforeEach } from 'vitest';
import { MarkAllNotificationsReadUseCase } from '../MarkAllNotificationsReadUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private markedAllReadForUsers: string[] = [];

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
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(): Promise<void> {}
  async markAllAsRead(userId: string): Promise<void> {
    this.markedAllReadForUsers.push(userId);
  }
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  getMarkedAllReadForUsers() {
    return this.markedAllReadForUsers;
  }
}

describe('MarkAllNotificationsReadUseCase', () => {
  let useCase: MarkAllNotificationsReadUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new MarkAllNotificationsReadUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should mark all notifications as read for user', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);
    expect(notifRepo.getMarkedAllReadForUsers()).toContain('user-1');
  });
});
