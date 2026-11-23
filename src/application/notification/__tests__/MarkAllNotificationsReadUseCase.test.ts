/** Mark-all clients receive explicit write failures and retain recipient scoping/time.
 * The use case must not report success when persistence cannot apply the transition. */
import { UserId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failure, success } from '@/domain/shared/Result';
import { MarkAllNotificationsReadUseCase } from '../MarkAllNotificationsReadUseCase';
import { NotificationRecipientRepository } from '../../../domain/notification/NotificationRecipientRepository';

class MockNotificationRecipientRepository implements Pick<
  NotificationRecipientRepository,
  'markAllAsRead'
> {
  private markedAllReadForUsers: UserId[] = [];

  async markAllAsRead(
    userId: UserId
  ): ReturnType<NotificationRecipientRepository['markAllAsRead']> {
    this.markedAllReadForUsers.push(userId);

    return success(undefined);
  }

  getMarkedAllReadForUsers() {
    return this.markedAllReadForUsers;
  }
}

describe('MarkAllNotificationsReadUseCase', () => {
  let useCase: MarkAllNotificationsReadUseCase;
  let notifRepo: MockNotificationRecipientRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRecipientRepository();
    useCase = new MarkAllNotificationsReadUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });
  });
  it('propagates a failed batch read update instead of reporting success', async () => {
    vi.spyOn(notifRepo, 'markAllAsRead').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(await useCase.execute({ userId: 'user-1' })).toEqual(
      failure('common.errors.unexpected')
    );
  });

  it('should mark all notifications as read for user', async () => {
    const write = vi.spyOn(notifRepo, 'markAllAsRead');
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);
    expect(notifRepo.getMarkedAllReadForUsers()).toContain('user-1');
    expect(write).toHaveBeenCalledWith(
      'user-1',
      notificationTestInputs.clock.now()
    );
  });
});
