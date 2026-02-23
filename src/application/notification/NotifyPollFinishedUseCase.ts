import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollFinishedDependencies {
  participantRepository: ParticipantRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyPollFinishedUseCase {
  constructor(private deps: NotifyPollFinishedDependencies) {}

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
          type: 'poll_finished',
          title: 'notification.types.pollFinished.title',
          body: 'notification.types.pollFinished.body',
          data: { pollId, pollTitle },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
