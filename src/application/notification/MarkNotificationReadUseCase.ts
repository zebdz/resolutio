import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { NotificationErrors } from './NotificationErrors';

export interface MarkNotificationReadDependencies {
  notificationRepository: NotificationRepository;
}

export class MarkNotificationReadUseCase {
  constructor(private deps: MarkNotificationReadDependencies) {}

  async execute(input: {
    notificationId: string;
    userId: string;
  }): Promise<Result<void, string>> {
    const { notificationId, userId } = input;

    const notification =
      await this.deps.notificationRepository.findById(notificationId);

    if (!notification) {
      return failure(NotificationErrors.NOT_FOUND);
    }

    if (notification.userId !== userId) {
      return failure(NotificationErrors.NOT_OWNER);
    }

    await this.deps.notificationRepository.markAsRead(notificationId);

    return success(undefined);
  }
}
