/** Verifies Notify Member Removed From Organization behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { UserId, OrganizationId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect } from 'vitest';
import { NotifyMemberRemovedFromOrganizationUseCase } from '../NotifyMemberRemovedFromOrganizationUseCase';
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

describe('NotifyMemberRemovedFromOrganizationUseCase', () => {
  it('saves a notification to the removed member with type and org data', async () => {
    const notifRepo = new MockNotificationRepository();
    const useCase = new NotifyMemberRemovedFromOrganizationUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });

    await useCase.execute({
      removedUserId: UserId.parse('user-1'),
      organizationId: OrganizationId.parse('org-1'),
      organizationName: 'Test Org',
    });

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('user-1');
    expect(saved!.type).toBe('member_removed_from_organization');
    expect(saved!.title).toBe(
      'notification.types.memberRemovedFromOrganization.title'
    );
    expect(saved!.body).toBe(
      'notification.types.memberRemovedFromOrganization.body'
    );
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
    });
  });
});
