import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { NotificationErrors } from './NotificationErrors';
import { DeleteNotificationsSchema } from './DeleteNotificationsSchema';

export interface DeleteNotificationsDependencies {
  notificationRepository: NotificationRepository;
}

export class DeleteNotificationsUseCase {
  constructor(private deps: DeleteNotificationsDependencies) {}

  async execute(input: {
    notificationIds: string[];
    userId: string;
  }): Promise<Result<void, string>> {
    const parsed = DeleteNotificationsSchema.safeParse(input);

    if (!parsed.success) {
      return failure(NotificationErrors.EMPTY_IDS);
    }

    const { notificationIds, userId } = parsed.data;

    const notifications =
      await this.deps.notificationRepository.findByIds(notificationIds);

    if (notifications.length !== notificationIds.length) {
      return failure(NotificationErrors.SOME_NOT_FOUND);
    }

    const allOwnedByUser = notifications.every((n) => n.userId === userId);

    if (!allOwnedByUser) {
      return failure(NotificationErrors.NOT_OWNER);
    }

    await this.deps.notificationRepository.deleteByIds(notificationIds);

    return success(undefined);
  }
}
