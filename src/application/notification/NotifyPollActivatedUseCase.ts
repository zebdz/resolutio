import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollActivatedDependencies {
  notificationRepository: NotificationRepository;
}

export interface NotifyPollActivatedInput {
  pollId: string;
  pollTitle: string;
  /**
   * Resolved by the caller: snapshot participants for organization polls,
   * organization members (including descendants) for open polls, which have
   * no participants until people vote.
   */
  recipientUserIds: string[];
}

export class NotifyPollActivatedUseCase {
  constructor(private deps: NotifyPollActivatedDependencies) {}

  async execute(input: NotifyPollActivatedInput): Promise<void> {
    const { pollId, pollTitle, recipientUserIds } = input;

    if (recipientUserIds.length === 0) {
      return;
    }

    const notifications = recipientUserIds
      .map((userId) =>
        Notification.create({
          userId,
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
