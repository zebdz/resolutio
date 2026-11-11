/** Recipient read transitions preserve ownership, idempotence and explicit storage failures.
 * Only validated IDs/time reach the port; unavailable state cannot authorize a write. */
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { NotificationId } from '@/domain/shared/EntityIds';
import {
  notificationTestInputs,
  notificationTestContent,
} from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failure, success } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
import { MarkNotificationReadUseCase } from '../MarkNotificationReadUseCase';
import { NotificationRecipientRepository } from '../../../domain/notification/NotificationRecipientRepository';
import { NotificationErrors } from '../NotificationErrors';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRecipientRepository implements Pick<
  NotificationRecipientRepository,
  'findById' | 'markAsRead'
> {
  private notifications: Map<NotificationId, Notification> = new Map();
  private markedAsRead: NotificationId[] = [];

  async findById(
    id: NotificationId
  ): ReturnType<NotificationRecipientRepository['findById']> {
    return success(this.notifications.get(id) ?? null);
  }
  async markAsRead(
    id: NotificationId
  ): ReturnType<NotificationRecipientRepository['markAsRead']> {
    this.markedAsRead.push(id);

    return success(undefined);
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

describe('MarkNotificationReadUseCase', () => {
  let useCase: MarkNotificationReadUseCase;
  let notifRepo: MockNotificationRecipientRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRecipientRepository();
    useCase = new MarkNotificationReadUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });
  });
  it('propagates a failed read update instead of reporting success', async () => {
    notifRepo.addNotification(createNotification('user-1', 'notif-1'));
    vi.spyOn(notifRepo, 'markAsRead').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(
      await useCase.execute({ notificationId: 'notif-1', userId: 'user-1' })
    ).toEqual(failure('common.errors.unexpected'));
  });
  it('stops before writing when the notification cannot be loaded', async () => {
    vi.spyOn(notifRepo, 'findById').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    const write = vi.spyOn(notifRepo, 'markAsRead');
    expect(
      await useCase.execute({ notificationId: 'notif-1', userId: 'user-1' })
    ).toEqual(failure('common.errors.unexpected'));
    expect(write).not.toHaveBeenCalled();
  });
  it('passes the authorized recipient and original read instant to persistence', async () => {
    const original = Instant.parse('2025-12-01T00:00:00.000Z');
    notifRepo.addNotification(
      expectSuccess(
        Notification.restore({
          ...notificationTestContent,
          id: 'notif-1',
          userId: 'user-1',
          readAt: new Date(original),
          createdAt: new Date('2025-11-01T00:00:00.000Z'),
        })
      )
    );
    const write = vi.spyOn(notifRepo, 'markAsRead');
    expect(
      await useCase.execute({ notificationId: 'notif-1', userId: 'user-1' })
    ).toEqual(success(undefined));
    expect(write).toHaveBeenCalledWith('notif-1', 'user-1', original);
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
