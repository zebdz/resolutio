import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyBoardMemberRemovedUseCase } from '../NotifyBoardMemberRemovedUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

class MockNotificationRepository implements NotificationRepository {
  private saved: Notification | null = null;

  async save(notification: Notification): Promise<Notification> {
    this.saved = notification;

    return notification;
  }
  async saveBatch(): Promise<void> {}
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
      notificationRepository: notifRepo,
    });
  });

  it('should save notification with correct type, title, body, data', async () => {
    await useCase.execute({
      removedUserId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'Test Org',
      boardId: 'board-1',
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
