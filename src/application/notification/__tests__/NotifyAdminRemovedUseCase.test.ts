/** Verifies Notify Admin Removed behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { UserId, OrganizationId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failure } from '@/domain/shared/Result';
import { NotifyAdminRemovedUseCase } from '../NotifyAdminRemovedUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    this.saved = notification;

    return success(notification);
  }
  async saveBatch(): ReturnType<NotificationRepository['saveBatch']> {
    return success(undefined);
  }

  getSaved() {
    return this.saved;
  }
}

describe('NotifyAdminRemovedUseCase', () => {
  let useCase: NotifyAdminRemovedUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyAdminRemovedUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });
  });

  it('returns an explicit failed delivery outcome when saving fails', async () => {
    vi.spyOn(notifRepo, 'save').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(
      await useCase.execute({
        removedUserId: UserId.parse('user-1'),
        organizationId: OrganizationId.parse('org-1'),
        organizationName: 'Org',
        actorName: 'Actor',
      })
    ).toEqual(failure('common.errors.unexpected'));
  });

  it('should save notification with correct type, title, body, data', async () => {
    await useCase.execute({
      removedUserId: UserId.parse('user-1'),
      organizationId: OrganizationId.parse('org-1'),
      organizationName: 'Test Org',
      actorName: 'Ivan Petrov',
    });

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('user-1');
    expect(saved!.type).toBe('admin_removed');
    expect(saved!.title).toBe('notification.types.adminRemoved.title');
    expect(saved!.body).toBe('notification.types.adminRemoved.body');
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
      actorName: 'Ivan Petrov',
    });
  });
});
