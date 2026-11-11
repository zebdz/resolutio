/** Selection deletion checks every recipient before writing and preserves explicit failures.
 * Missing, foreign or unavailable selections must leave all notifications untouched. */
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { NotificationId } from '@/domain/shared/EntityIds';
import { notificationTestContent } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failure, success } from '@/domain/shared/Result';
import { DeleteNotificationsUseCase } from '../DeleteNotificationsUseCase';
import { NotificationRecipientRepository } from '../../../domain/notification/NotificationRecipientRepository';
import { NotificationErrors } from '../NotificationErrors';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRecipientRepository implements Pick<
  NotificationRecipientRepository,
  'findByIds' | 'deleteByIds'
> {
  private notifications: Map<NotificationId, Notification> = new Map();
  private deletedIds: NotificationId[] = [];

  async findByIds(
    ids: readonly NotificationId[]
  ): ReturnType<NotificationRecipientRepository['findByIds']> {
    return success(
      ids
        .map((id) => this.notifications.get(id))
        .filter((n): n is Notification => n !== undefined)
    );
  }
  async deleteByIds(
    ids: readonly NotificationId[]
  ): ReturnType<NotificationRecipientRepository['deleteByIds']> {
    this.deletedIds.push(...ids);
    ids.forEach((id) => this.notifications.delete(id));

    return success(undefined);
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

describe('DeleteNotificationsUseCase', () => {
  let useCase: DeleteNotificationsUseCase;
  let notifRepo: MockNotificationRecipientRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRecipientRepository();
    useCase = new DeleteNotificationsUseCase({
      notificationRepository: notifRepo,
    });
  });
  it('propagates failed deletion instead of reporting success', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));
    vi.spyOn(notifRepo, 'deleteByIds').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(
      await useCase.execute({ notificationIds: ['notif-1'], userId: 'user-1' })
    ).toEqual(failure('common.errors.unexpected'));
  });
  it('does not delete when the selection cannot be loaded', async () => {
    vi.spyOn(notifRepo, 'findByIds').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    const write = vi.spyOn(notifRepo, 'deleteByIds');
    expect(
      await useCase.execute({ notificationIds: ['notif-1'], userId: 'user-1' })
    ).toEqual(failure('common.errors.unexpected'));
    expect(write).not.toHaveBeenCalled();
  });

  it('should delete notifications belonging to user', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));
    notifRepo.addNotification(createNotification('user-1', 'notif-2'));
    const write = vi.spyOn(notifRepo, 'deleteByIds');

    const result = await useCase.execute({
      notificationIds: ['notif-1', 'notif-2'],
      userId: 'user-1',
    });

    expect(result.success).toBe(true);
    expect(notifRepo.getDeletedIds()).toEqual(['notif-1', 'notif-2']);
    expect(write).toHaveBeenCalledWith(['notif-1', 'notif-2'], 'user-1');
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
    expect(notifRepo.getDeletedIds()).toEqual([]);

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
    expect(notifRepo.getDeletedIds()).toEqual([]);

    if (!result.success) {
      expect(result.error).toBe(NotificationErrors.SOME_NOT_FOUND);
    }
  });
});
