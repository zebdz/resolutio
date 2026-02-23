import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollActivatedDependencies {
  participantRepository: ParticipantRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyPollActivatedUseCase {
  constructor(private deps: NotifyPollActivatedDependencies) {}

  async execute(input: { pollId: string; pollTitle: string }): Promise<void> {
    const { pollId, pollTitle } = input;

    const participantsResult =
      await this.deps.participantRepository.getParticipants(pollId);

    if (!participantsResult.success) {
      return;
    }

    const participants = participantsResult.value;

    if (participants.length === 0) {
      return;
    }

    const notifications = participants
      .map((p) =>
        Notification.create({
          userId: p.userId,
          type: 'poll_activated',
          title: 'notification.types.pollActivated.title',
          body: 'notification.types.pollActivated.body',
          data: { pollId, pollTitle },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
