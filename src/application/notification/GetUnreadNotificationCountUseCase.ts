import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success } from '../../domain/shared/Result';

export interface GetUnreadNotificationCountDependencies {
  notificationRepository: NotificationRepository;
}

export class GetUnreadNotificationCountUseCase {
  constructor(private deps: GetUnreadNotificationCountDependencies) {}

  async execute(input: {
    userId: string;
  }): Promise<Result<{ count: number }, string>> {
    const count = await this.deps.notificationRepository.getUnreadCount(
      input.userId
    );

    return success({ count });
  }
}
