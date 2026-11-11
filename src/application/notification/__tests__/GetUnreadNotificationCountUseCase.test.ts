/** Unread-count clients distinguish a valid zero from an unavailable count.
 * Recipient validation and typed Result propagation precede presentation. */
import { NotificationCount } from '@/domain/notification/NotificationContent';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { success, failure } from '@/domain/shared/Result';
import { GetUnreadNotificationCountUseCase } from '../GetUnreadNotificationCountUseCase';
import { NotificationReader } from '../../../domain/notification/NotificationReader';
import { UserId } from '@/domain/shared/EntityIds';

class MockNotificationReader implements Pick<
  NotificationReader,
  'getUnreadCount'
> {
  private unreadCounts: Map<UserId, NotificationCount> = new Map();

  async getUnreadCount(
    userId: UserId
  ): ReturnType<NotificationReader['getUnreadCount']> {
    return success(NotificationCount.parse(this.unreadCounts.get(userId) || 0));
  }
  setUnreadCount(userId: string, count: number) {
    this.unreadCounts.set(UserId.parse(userId), NotificationCount.parse(count));
  }
}

describe('GetUnreadNotificationCountUseCase', () => {
  let useCase: GetUnreadNotificationCountUseCase;
  let notifRepo: MockNotificationReader;

  beforeEach(() => {
    notifRepo = new MockNotificationReader();
    useCase = new GetUnreadNotificationCountUseCase({
      notificationReader: notifRepo,
    });
  });
  it('propagates unavailable counts rather than returning a successful value', async () => {
    vi.spyOn(notifRepo, 'getUnreadCount').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(await useCase.execute({ userId: 'user-1' })).toEqual(
      failure('common.errors.unexpected')
    );
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
