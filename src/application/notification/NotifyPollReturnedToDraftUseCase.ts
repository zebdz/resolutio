import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyPollReturnedToDraftDependencies {
  notificationRepository: NotificationRepository;
}

export interface NotifyPollReturnedToDraftInput {
  pollId: string;
  pollTitle: string;
  /** The author, who gets the poll back. */
  createdBy: string;
  /** Whoever pressed the button. */
  returnedByUserId: string;
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

  async execute(input: NotifyPollReturnedToDraftInput): Promise<void> {
    if (input.returnedByUserId === input.createdBy) {
      return;
    }

    const notification = Notification.create({
      userId: input.createdBy,
      type: 'poll_returned_to_draft',
      title: 'notification.types.pollReturnedToDraft.title',
      body: 'notification.types.pollReturnedToDraft.body',
      data: { pollId: input.pollId, pollTitle: input.pollTitle },
    });

    if (!notification.success) {
      return;
    }

    await this.deps.notificationRepository.saveBatch([notification.value]);
  }
}
