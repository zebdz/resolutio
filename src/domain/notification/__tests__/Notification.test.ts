/** Notification clients observe immutable payloads, explicit creation and stable read time. */
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { describe, it, expect } from 'vitest';
import { Notification } from '../Notification';
import { NotificationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { testCreation } from '../../shared/__tests__/creation';
import { notificationTestContent } from '@/application/notification/__tests__/notificationTestValues';

function notification(readAt: Date | null = null) {
  return expectSuccess(
    Notification.restore({
      id: 'notif-1',
      userId: 'user-1',
      ...notificationTestContent,
      createdAt: new Date('2026-01-01'),
      readAt,
    })
  );
}

describe('Notification', () => {
  it('creates unread at the supplied instant', () => {
    const creation = testCreation(NotificationId, 'notif-1');
    const result = Notification.create(
      { userId: UserId.parse('user-1'), ...notificationTestContent },
      creation
    );
    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.value.toJSON()).toEqual({
      id: 'notif-1',
      userId: 'user-1',
      ...notificationTestContent,
      readAt: null,
      createdAt: new Date(creation.now),
    });
  });
  it('requires the content appropriate to its kind', () => {
    const data = notification().toJSON();
    expect(Notification.restore({ ...data, data: null })).toEqual({
      success: false,
      error: 'domain.notification.invalidData',
    });
  });
  it('rehydrates without sharing mutable date or payload references', () => {
    const readAt = new Date('2026-01-02');
    const item = notification(readAt);
    readAt.setFullYear(2000);
    item.toJSON().createdAt.setFullYear(2000);
    expect(item.readAt).toEqual(new Date('2026-01-02'));
    expect(item.createdAt).toEqual(new Date('2026-01-01'));
    expect(Object.isFrozen(item.data)).toBe(true);
  });
  it('marks an unread notification at the supplied instant', () => {
    const item = notification();
    expect(item.isRead()).toBe(false);
    item.markAsRead(Instant.parse('2026-01-02T00:00:00.000Z'));
    expect(item.isRead()).toBe(true);
    expect(item.readAt).toEqual(new Date('2026-01-02'));
  });
  it('retains the original read time when read again', () => {
    const item = notification(new Date('2026-01-02'));
    item.markAsRead(Instant.parse('2026-01-03T00:00:00.000Z'));
    expect(item.readAt).toEqual(new Date('2026-01-02'));
  });
});
