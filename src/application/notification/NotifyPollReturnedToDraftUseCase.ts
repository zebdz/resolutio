/** Builds poll returned to draft notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, PollId, UserId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollReturnedToDraftDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export interface NotifyPollReturnedToDraftInput {
  pollId: PollId;
  pollTitle: string;
  /** The author, who gets the poll back. */
  createdBy: UserId;
  /** Whoever pressed the button. */
  returnedByUserId: UserId;
}

/**
 * Tells an author their poll came back for changes.
 *
 * Sent only when someone else returned it: an author recalling their own poll
 * already knows, and telling them would be noise. Without this the poll simply
 * reappears as a draft with no indication that anyone wanted anything changed.
 */
export class NotifyPollReturnedToDraftUseCase {
  constructor(private deps: NotifyPollReturnedToDraftDependencies) {}

  async execute(
    input: NotifyPollReturnedToDraftInput
  ): Promise<Result<void, NotificationDeliveryFailure>> {
    if (input.returnedByUserId === input.createdBy) {
      return success(undefined);
    }

    const notification = Notification.create(
      {
        userId: input.createdBy,
        type: 'poll_returned_to_draft',
        title: 'notification.types.pollReturnedToDraft.title',
        body: 'notification.types.pollReturnedToDraft.body',
        data: { pollId: input.pollId, pollTitle: input.pollTitle },
      },
      entityCreation(NotificationId, this.deps.ids, this.deps.clock)
    );

    if (!notification.success) {
      return notification;
    }

    return this.deps.notificationRepository.saveBatch([notification.value]);
  }
}
