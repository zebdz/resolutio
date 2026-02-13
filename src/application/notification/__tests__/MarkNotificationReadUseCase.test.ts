import { describe, it, expect, beforeEach } from 'vitest';
import { MarkNotificationReadUseCase } from '../MarkNotificationReadUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { NotificationErrors } from '../NotificationErrors';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private notifications: Map<string, Notification> = new Map();
  private markedAsRead: string[] = [];

  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(): Promise<void> {}
  async findById(id: string): Promise<Notification | null> {
    return this.notifications.get(id) || null;
  }
  async findByUserId(): Promise<Notification[]> {
    return [];
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async markAsRead(id: string): Promise<void> {
    this.markedAsRead.push(id);
  }
  async markAllAsRead(): Promise<void> {}
  async findByIds(): Promise<Notification[]> {
    return [];
  }
  async deleteByIds(): Promise<void> {}
  async getCountByUserId(): Promise<number> {
    return 0;
  }

  // Test helpers
  addNotification(notification: Notification) {
    this.notifications.set(notification.id, notification);
  }
  getMarkedAsRead() {
    return this.markedAsRead;
  }
}

function createNotification(userId: string, id: string): Notification {
  return Notification.reconstitute({
    id,
    userId,
    type: 'org_joined_parent',
    title: 'title',
    body: 'body',
    data: null,
    readAt: null,
    createdAt: new Date(),
  });
}

describe('MarkNotificationReadUseCase', () => {
  let useCase: MarkNotificationReadUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new MarkNotificationReadUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should mark notification as read', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));

    const result = await useCase.execute({
      notificationId: 'notif-1',
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(notifRepo.getMarkedAsRead()).toContain('notif-1');
  });

  it('should fail if notification not found', async () => {
    const result = await useCase.execute({
      notificationId: 'nonexistent',
      userId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.NOT_FOUND);
    }
  });

  it('should fail if notification belongs to another user', async () => {
    notifRepo.addNotification(createNotification('user-2', 'notif-1'));

    const result = await useCase.execute({
      notificationId: 'notif-1',
      userId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.NOT_OWNER);
    }
  });
});
