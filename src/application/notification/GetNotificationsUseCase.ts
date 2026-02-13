import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { NotificationProps } from '../../domain/notification/Notification';
import { Result, success } from '../../domain/shared/Result';

export interface GetNotificationsDependencies {
  notificationRepository: NotificationRepository;
}

export interface GetNotificationsResult {
  notifications: NotificationProps[];
  unreadCount: number;
  totalCount: number;
}

export class GetNotificationsUseCase {
  constructor(private deps: GetNotificationsDependencies) {}

  async execute(input: {
    userId: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<GetNotificationsResult, string>> {
    const { userId, limit, offset } = input;

    const [notifications, unreadCount, totalCount] = await Promise.all([
      this.deps.notificationRepository.findByUserId(userId, { limit, offset }),
      this.deps.notificationRepository.getUnreadCount(userId),
      this.deps.notificationRepository.getCountByUserId(userId),
    ]);

    return success({
      notifications: notifications.map((n) => n.toJSON()),
      unreadCount,
      totalCount,
    });
  }
}
