import { describe, it, expect, beforeEach } from 'vitest';
import { DeleteNotificationsUseCase } from '../DeleteNotificationsUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { NotificationErrors } from '../NotificationErrors';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private notifications: Map<string, Notification> = new Map();
  private deletedIds: string[] = [];

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
  async markAsRead(): Promise<void> {}
  async markAllAsRead(): Promise<void> {}
  async findByIds(ids: string[]): Promise<Notification[]> {
    return ids
      .map((id) => this.notifications.get(id))
      .filter((n): n is Notification => n !== undefined);
  }
  async deleteByIds(ids: string[]): Promise<void> {
    this.deletedIds.push(...ids);
    ids.forEach((id) => this.notifications.delete(id));
  }
  async getCountByUserId(userId: string): Promise<number> {
    return [...this.notifications.values()].filter((n) => n.userId === userId)
      .length;
  }

  // Test helpers
  addNotification(notification: Notification) {
    this.notifications.set(notification.id, notification);
  }
  getDeletedIds() {
    return this.deletedIds;
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

describe('DeleteNotificationsUseCase', () => {
  let useCase: DeleteNotificationsUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new DeleteNotificationsUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should delete notifications belonging to user', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));
    notifRepo.addNotification(createNotification('user-1', 'notif-2'));

    const result = await useCase.execute({
      notificationIds: ['notif-1', 'notif-2'],
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(notifRepo.getDeletedIds()).toEqual(['notif-1', 'notif-2']);
  });

  it('should fail EMPTY_IDS on empty array', async () => {
    const result = await useCase.execute({
      notificationIds: [],
      userId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.EMPTY_IDS);
    }
  });

  it('should fail NOT_OWNER when any notification belongs to different user', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));
    notifRepo.addNotification(createNotification('user-2', 'notif-2'));

    const result = await useCase.execute({
      notificationIds: ['notif-1', 'notif-2'],
      userId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.NOT_OWNER);
    }
  });

  it("should fail SOME_NOT_FOUND when any ID doesn't exist", async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));

    const result = await useCase.execute({
      notificationIds: ['notif-1', 'nonexistent'],
      userId: 'user-1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.SOME_NOT_FOUND);
    }
  });
});
