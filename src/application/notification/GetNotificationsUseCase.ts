/** Reads validated recipient/paging data and returns detached presentation DTOs.
 * Every list/count failure propagates explicitly; unavailable reads never become an empty inbox. */
import { NotificationFailure } from './NotificationErrors';
import { z } from 'zod';
import { UserId } from '@/domain/shared/EntityIds';
import { ResultLimit } from '@/domain/shared/Pagination';
import {
  NotificationOffset,
  NotificationCount,
} from '@/domain/notification/NotificationContent';
import type { NotificationReader } from '../../domain/notification/NotificationReader';
import { NotificationSnapshot } from '../../domain/notification/Notification';
import { Result, success, failure } from '../../domain/shared/Result';

export interface GetNotificationsDependencies {
  notificationReader: NotificationReader;
}

export interface GetNotificationsResult {
  notifications: NotificationSnapshot[];
  unreadCount: NotificationCount;
  totalCount: NotificationCount;
}

export class GetNotificationsUseCase {
  constructor(private deps: GetNotificationsDependencies) {}

  async execute(input: {
    userId: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<GetNotificationsResult, NotificationFailure>> {
    const parsed = z
      .object({
        userId: UserId,
        limit: ResultLimit.optional(),
        offset: NotificationOffset.optional(),
      })
      .safeParse(input);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const { userId, limit, offset } = parsed.data;

    const [notifications, unreadCount, totalCount] = await Promise.all([
      this.deps.notificationReader.findByUserId(userId, { limit, offset }),
      this.deps.notificationReader.getUnreadCount(userId),
      this.deps.notificationReader.getCountByUserId(userId),
    ]);

    if (!notifications.success) {
      return notifications;
    }

    if (!unreadCount.success) {
      return unreadCount;
    }

    if (!totalCount.success) {
      return totalCount;
    }

    return success({
      notifications: notifications.value.map((n) => n.toJSON()),
      unreadCount: unreadCount.value,
      totalCount: totalCount.value,
    });
  }
}
