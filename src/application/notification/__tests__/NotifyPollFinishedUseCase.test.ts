import { describe, it, expect, beforeEach } from 'vitest';
import { NotifyPollFinishedUseCase } from '../NotifyPollFinishedUseCase';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { Notification } from '../../../domain/notification/Notification';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Result, success } from '../../../domain/shared/Result';

// Mock NotificationRepository
class MockNotificationRepository implements NotificationRepository {
  private savedBatch: Notification[] = [];

  async save(notification: Notification): Promise<Notification> {
    return notification;
  }
  async saveBatch(notifications: Notification[]): Promise<void> {
    this.savedBatch.push(...notifications);
  }
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

  getSavedBatch() {
    return this.savedBatch;
  }
}

// Mock ParticipantRepository
class MockParticipantRepository implements ParticipantRepository {
  private participants: Map<string, PollParticipant[]> = new Map();

  async createParticipants(): Promise<Result<void, string>> {
    return success(undefined);
  }
  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    return success(this.participants.get(pollId) || []);
  }
  async getParticipantById(): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }
  async getParticipantByUserAndPoll(): Promise<
    Result<PollParticipant | null, string>
  > {
    return success(null);
  }
  async updateParticipantWeight(): Promise<Result<void, string>> {
    return success(undefined);
  }
  async deleteParticipant(): Promise<Result<void, string>> {
    return success(undefined);
  }
  async deleteParticipantsByPollId(): Promise<Result<void, string>> {
    return success(undefined);
  }
  async createWeightHistory(): Promise<Result<any, string>> {
    return success({} as any);
  }
  async getWeightHistory(): Promise<Result<any[], string>> {
    return success([]);
  }
  async getParticipantWeightHistory(): Promise<Result<any[], string>> {
    return success([]);
  }
  async executeActivation(): Promise<Result<PollParticipant[], string>> {
    return success([]);
  }

  // Test helper
  setParticipants(pollId: string, participants: PollParticipant[]) {
    this.participants.set(pollId, participants);
  }
}

function createParticipant(pollId: string, userId: string): PollParticipant {
  return PollParticipant.reconstitute({
    id: `participant-${userId}`,
    pollId,
    userId,
    userWeight: 1.0,
    willingToSignProtocol: null,
    snapshotAt: new Date(),
    createdAt: new Date(),
  });
}

describe('NotifyPollFinishedUseCase', () => {
  let useCase: NotifyPollFinishedUseCase;
  let notifRepo: MockNotificationRepository;
  let participantRepo: MockParticipantRepository;

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    participantRepo = new MockParticipantRepository();
    useCase = new NotifyPollFinishedUseCase({
      notificationRepository: notifRepo,
      participantRepository: participantRepo,
    });
  });

  it('should notify all poll participants', async () => {
    participantRepo.setParticipants('poll-1', [
      createParticipant('poll-1', 'user-1'),
      createParticipant('poll-1', 'user-2'),
    ]);

    await useCase.execute({ pollId: 'poll-1', pollTitle: 'Budget Vote' });

    const saved = notifRepo.getSavedBatch();
    expect(saved).toHaveLength(2);

    for (const notification of saved) {
      expect(notification.type).toBe('poll_finished');
      expect(notification.title).toBe('notification.types.pollFinished.title');
      expect(notification.body).toBe('notification.types.pollFinished.body');
      expect(notification.data).toEqual({
        pollId: 'poll-1',
        pollTitle: 'Budget Vote',
      });
    }

    const userIds = saved.map((n) => n.userId);
    expect(userIds).toContain('user-1');
    expect(userIds).toContain('user-2');
  });

  it('should not create notifications when no participants', async () => {
    participantRepo.setParticipants('poll-1', []);

    await useCase.execute({ pollId: 'poll-1', pollTitle: 'Budget Vote' });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle getParticipants failure gracefully', async () => {
    participantRepo.getParticipants = async () => ({
      success: false as const,
      error: 'db error',
    });

    await useCase.execute({ pollId: 'poll-1', pollTitle: 'Budget Vote' });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
