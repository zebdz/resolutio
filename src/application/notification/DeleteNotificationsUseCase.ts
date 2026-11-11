/** Deletes a selection only after loading every notification and checking recipient ownership.
 * Load/delete failures propagate explicitly; unauthorized or missing selections never reach writes. */
import { NotificationFailure } from './NotificationErrors';
import type { NotificationRecipientRepository } from '../../domain/notification/NotificationRecipientRepository';
import { Result, failure } from '../../domain/shared/Result';
import { NotificationErrors } from './NotificationErrors';
import { DeleteNotificationsSchema } from './DeleteNotificationsSchema';

export interface DeleteNotificationsDependencies {
  notificationRepository: Pick<
    NotificationRecipientRepository,
    'findByIds' | 'deleteByIds'
  >;
}

export class DeleteNotificationsUseCase {
  constructor(private deps: DeleteNotificationsDependencies) {}

  async execute(input: {
    notificationIds: string[];
    userId: string;
  }): Promise<Result<void, NotificationFailure>> {
    const parsed = DeleteNotificationsSchema.safeParse(input);

    if (!parsed.success) {
      return failure(NotificationErrors.EMPTY_IDS);
    }

    const { notificationIds, userId } = parsed.data;

    const loaded =
      await this.deps.notificationRepository.findByIds(notificationIds);

    if (!loaded.success) {
      return loaded;
    }

    const notifications = loaded.value;

    if (notifications.length !== notificationIds.length) {
      return failure(NotificationErrors.SOME_NOT_FOUND);
    }

    const allOwnedByUser = notifications.every((n) => n.userId === userId);

    if (!allOwnedByUser) {
      return failure(NotificationErrors.NOT_OWNER);
    }

    return this.deps.notificationRepository.deleteByIds(
      notificationIds,
      userId
    );
  }
}
