import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success } from '../../domain/shared/Result';

export interface MarkAllNotificationsReadDependencies {
  notificationRepository: NotificationRepository;
}

export class MarkAllNotificationsReadUseCase {
  constructor(private deps: MarkAllNotificationsReadDependencies) {}

  async execute(input: { userId: string }): Promise<Result<void, string>> {
    await this.deps.notificationRepository.markAllAsRead(input.userId);

    return success(undefined);
  }
}
