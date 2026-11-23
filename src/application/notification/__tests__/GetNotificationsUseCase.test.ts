/** Inbox clients retain recipient scope/paging and propagate each explicit read failure.
 * A valid empty result remains distinct from an unavailable list or count. */
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import { notificationTestContent } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { success, failure } from '@/domain/shared/Result';
import { GetNotificationsUseCase } from '../GetNotificationsUseCase';
import { NotificationReader } from '@/domain/notification/NotificationReader';
import { UserId } from '@/domain/shared/EntityIds';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationReader implements NotificationReader {
  private notifications: Notification[] = [];
  private unreadCounts: Map<UserId, NotificationCount> = new Map();

  async findByUserId(
    userId: UserId,
    options?: Parameters<NotificationReader['findByUserId']>[1]
  ): ReturnType<NotificationReader['findByUserId']> {
    let results = this.notifications.filter((n) => n.userId === userId);

    if (options?.offset) {
      results = results.slice(options.offset);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return success(results);
  }
  async getUnreadCount(
    userId: UserId
  ): ReturnType<NotificationReader['getUnreadCount']> {
    return success(NotificationCount.parse(this.unreadCounts.get(userId) || 0));
  }
  async getCountByUserId(
    userId: UserId
  ): ReturnType<NotificationReader['getCountByUserId']> {
    return success(
      NotificationCount.parse(
        this.notifications.filter((n) => n.userId === userId).length
      )
    );
  }

  // Test helpers
  addNotification(notification: Notification) {
    this.notifications.push(notification);
  }
  setUnreadCount(userId: string, count: number) {
    this.unreadCounts.set(UserId.parse(userId), NotificationCount.parse(count));
  }
}

function createNotification(
  userId: string,
  id: string = 'notif-1'
): Notification {
  return expectSuccess(
    Notification.restore({
      ...notificationTestContent,
      id,
      userId,
      readAt: null,
      createdAt: new Date(),
    })
  );
}

describe('GetNotificationsUseCase', () => {
  let useCase: GetNotificationsUseCase;
  let notifRepo: MockNotificationReader;

  beforeEach(() => {
    notifRepo = new MockNotificationReader();
    useCase = new GetNotificationsUseCase({
      notificationReader: notifRepo,
    });
  });

  it('propagates an unavailable inbox instead of throwing or fabricating an empty list', async () => {
    vi.spyOn(notifRepo, 'findByUserId').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(await useCase.execute({ userId: 'user-1' })).toEqual(
      failure('common.errors.unexpected')
    );
  });
  it.each(['getUnreadCount', 'getCountByUserId'] as const)(
    'propagates an unavailable %s alongside a valid list',
    async (method) => {
      vi.spyOn(notifRepo, method).mockResolvedValue(
        failure('common.errors.unexpected')
      );
      expect(await useCase.execute({ userId: 'user-1' })).toEqual(
        failure('common.errors.unexpected')
      );
    }
  );

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
