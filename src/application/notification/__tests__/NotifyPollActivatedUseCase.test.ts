import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyPollActivatedUseCase } from '../NotifyPollActivatedUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

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

describe('NotifyPollActivatedUseCase', () => {
  let useCase: NotifyPollActivatedUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyPollActivatedUseCase({
      notificationRepository: notifRepo,
    });
  });

  it('should notify every recipient the caller resolved', async () => {
    await useCase.execute({
      pollId: 'poll-1',
      pollTitle: 'Budget Vote',
      recipientUserIds: ['user-1', 'user-2', 'user-3'],
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(3);

    for (const notification of saved) {
      expect(notification.type).toBe('poll_activated');
      expect(notification.title).toBe('notification.types.pollActivated.title');
      expect(notification.body).toBe('notification.types.pollActivated.body');
      expect(notification.data).toEqual({
        pollId: 'poll-1',
        pollTitle: 'Budget Vote',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('user-3');
  });

  it('should not create notifications when there are no recipients', async () => {
    await useCase.execute({
      pollId: 'poll-1',
      pollTitle: 'Budget Vote',
      recipientUserIds: [],
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
