/** Verifies Notify Poll Activated behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { success } from '@/domain/shared/Result';
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { failure } from '@/domain/shared/Result';
import { NotifyPollActivatedUseCase } from '../NotifyPollActivatedUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { Notification } from '../../../domain/notification/Notification';

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private savedBatch: Notification[] = [];

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    return success(notification);
  }
  async saveBatch(
    notifications: Notification[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    this.savedBatch.push(...notifications);

    return success(undefined);
  }

  getSavedBatch() {
    return this.savedBatch;
  }
}

describe('NotifyPollActivatedUseCase', () => {
  let useCase: NotifyPollActivatedUseCase;
  let notifRepo: MockNotificationRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    useCase = new NotifyPollActivatedUseCase({
      ...notificationTestInputs,
      notificationRepository: notifRepo,
    });
  });

  it('propagates a failed batch save instead of losing the delivery outcome', async () => {
    vi.spyOn(notifRepo, 'saveBatch').mockResolvedValue(
      failure('common.errors.unexpected')
    );
    expect(
      await useCase.execute({
        pollId: PollId.parse('poll-1'),
        pollTitle: 'Poll',
        recipientUserIds: [UserId.parse('user-1')],
      })
    ).toEqual(failure('common.errors.unexpected'));
  });

  it('should notify every recipient the caller resolved', async () => {
    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Budget Vote',
      recipientUserIds: [
        UserId.parse('user-1'),
        UserId.parse('user-2'),
        UserId.parse('user-3'),
      ],
    });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(3);

    for (const notification of saved) {
      expect(notification.type).toBe('poll_activated');
      expect(notification.title).toBe('notification.types.pollActivated.title');
      expect(notification.body).toBe('notification.types.pollActivated.body');
      expect(notification.data).toEqual({
        pollId: 'poll-1',
        pollTitle: 'Budget Vote',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
    expect(userIds).toContain('user-3');
  });

  it('should not create notifications when there are no recipients', async () => {
    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Budget Vote',
      recipientUserIds: [],
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
