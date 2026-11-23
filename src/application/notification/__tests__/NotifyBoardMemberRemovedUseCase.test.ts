/** Verifies Notify Board Member Removed behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { UserId, OrganizationId, BoardId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyBoardMemberRemovedUseCase } from '../NotifyBoardMemberRemovedUseCase';
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

describe('NotifyBoardMemberRemovedUseCase', () => {
  let useCase: NotifyBoardMemberRemovedUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyBoardMemberRemovedUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });
  });

  it('should save notification with correct type, title, body, data', async () => {
    await useCase.execute({
      removedUserId: UserId.parse('user-1'),
      organizationId: OrganizationId.parse('org-1'),
      organizationName: 'Test Org',
      boardId: BoardId.parse('board-1'),
      boardName: 'Main Board',
      actorName: 'Ivan Petrov',
    });

    const saved = notifRepo.getSaved();
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe('user-1');
    expect(saved!.type).toBe('board_member_removed');
    expect(saved!.title).toBe('notification.types.boardMemberRemoved.title');
    expect(saved!.body).toBe('notification.types.boardMemberRemoved.body');
    expect(saved!.data).toEqual({
      organizationId: 'org-1',
      organizationName: 'Test Org',
      boardId: 'board-1',
      boardName: 'Main Board',
      actorName: 'Ivan Petrov',
    });
  });
});
