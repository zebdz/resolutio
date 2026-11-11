/** Builds poll activated notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, PollId, UserId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollActivatedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export interface NotifyPollActivatedInput {
  pollId: PollId;
  pollTitle: string;
  /**
   * Resolved by the caller: snapshot participants for organization polls,
   * organization members (including descendants) for open polls, which have
   * no participants until people vote.
   */
  recipientUserIds: UserId[];
}

export class NotifyPollActivatedUseCase {
  constructor(private deps: NotifyPollActivatedDependencies) {}

  async execute(
    input: NotifyPollActivatedInput
  ): Promise<Result<void, NotificationDeliveryFailure>> {
    const { pollId, pollTitle, recipientUserIds } = input;

    if (recipientUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      recipientUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'poll_activated',
            title: 'notification.types.pollActivated.title',
            body: 'notification.types.pollActivated.body',
            data: { pollId, pollTitle },
          },
          entityCreation(NotificationId, this.deps.ids, this.deps.clock)
        )
      )
    );

    if (!notifications.success) {
      return notifications;
    }

    return this.deps.notificationRepository.saveBatch(notifications.value);
  }
}
