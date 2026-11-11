/** Verifies Notify Poll Finished behavior through application ports.
 * Notification doubles return explicit append outcomes, matching the production writer. */
import { PollId } from '@/domain/shared/EntityIds';
import { notificationTestInputs } from '@/application/notification/__tests__/notificationTestValues';
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

// Mock ParticipantRepository
class MockParticipantRepository implements ParticipantRepository {
  private participants: Map<string, PollParticipant[]> = new Map();

  async createParticipants(): ReturnType<
    ParticipantRepository['createParticipants']
  > {
    return success(undefined);
  }
  async getParticipants(
    pollId: string
  ): ReturnType<ParticipantRepository['getParticipants']> {
    return success(this.participants.get(pollId) || []);
  }
  async getParticipantById(): ReturnType<
    ParticipantRepository['getParticipantById']
  > {
    return success(null);
  }
  async getParticipantByUserAndPoll(): ReturnType<
    ParticipantRepository['getParticipantByUserAndPoll']
  > {
    return success(null);
  }
  async updateParticipantWeight(): ReturnType<
    ParticipantRepository['updateParticipantWeight']
  > {
    return success(undefined);
  }
  async deleteParticipant(): ReturnType<
    ParticipantRepository['deleteParticipant']
  > {
    return success(undefined);
  }
  async deleteParticipantsByPollId(): ReturnType<
    ParticipantRepository['deleteParticipantsByPollId']
  > {
    return success(undefined);
  }
  async createWeightHistory(): ReturnType<
    ParticipantRepository['createWeightHistory']
  > {
    return success({} as any);
  }
  async getWeightHistory(): ReturnType<
    ParticipantRepository['getWeightHistory']
  > {
    return success([]);
  }
  async getParticipantWeightHistory(): ReturnType<
    ParticipantRepository['getParticipantWeightHistory']
  > {
    return success([]);
  }
  async executeActivation(): ReturnType<
    ParticipantRepository['executeActivation']
  > {
    return success([]);
  }

  // Test helper
  setParticipants(pollId: string, participants: PollParticipant[]) {
    this.participants.set(pollId, participants);
  }

  async getCastBallot(
    ..._args: Parameters<ParticipantRepository['getCastBallot']>
  ): ReturnType<ParticipantRepository['getCastBallot']> {
    throw new Error('Unexpected test repository call: getCastBallot');
  }
  async castVotes(
    ..._args: Parameters<ParticipantRepository['castVotes']>
  ): ReturnType<ParticipantRepository['castVotes']> {
    throw new Error('Unexpected test repository call: castVotes');
  }
  async updateWillingToSignProtocol(
    ..._args: Parameters<ParticipantRepository['updateWillingToSignProtocol']>
  ): ReturnType<ParticipantRepository['updateWillingToSignProtocol']> {
    throw new Error(
      'Unexpected test repository call: updateWillingToSignProtocol'
    );
  }
  async joinAndVote(
    ..._args: Parameters<ParticipantRepository['joinAndVote']>
  ): ReturnType<ParticipantRepository['joinAndVote']> {
    throw new Error('Unexpected test repository call: joinAndVote');
  }
  async pollHasVotes(
    ..._args: Parameters<ParticipantRepository['pollHasVotes']>
  ): ReturnType<ParticipantRepository['pollHasVotes']> {
    throw new Error('Unexpected test repository call: pollHasVotes');
  }
  async applyWeightConfigChange(
    ..._args: Parameters<ParticipantRepository['applyWeightConfigChange']>
  ): ReturnType<ParticipantRepository['applyWeightConfigChange']> {
    throw new Error('Unexpected test repository call: applyWeightConfigChange');
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
      ...notificationTestInputs,
      notificationRepository: notifRepo,
      participantRepository: participantRepo,
    });
  });

  it('should notify all poll participants', async () => {
    participantRepo.setParticipants('poll-1', [
      createParticipant('poll-1', 'user-1'),
      createParticipant('poll-1', 'user-2'),
    ]);

    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Budget Vote',
    });

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

    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Budget Vote',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });

  it('should handle getParticipants failure gracefully', async () => {
    participantRepo.getParticipants = async () => ({
      success: false as const,
      error: 'common.errors.unexpected',
    });

    await useCase.execute({
      pollId: PollId.parse('poll-1'),
      pollTitle: 'Budget Vote',
    });

    expect(notifRepo.getSavedBatch()).toHaveLength(0);
  });
});
