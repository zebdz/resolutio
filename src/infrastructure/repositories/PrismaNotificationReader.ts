/** Prisma inbox reader decodes stored events/counts and translates query failures into Results.
 * Row validation stays outside query catches; malformed events fail the complete read. */
import type { PrismaClient } from '@/generated/prisma';
import type { UserId } from '@/domain/shared/EntityIds';
import { success, failure } from '@/domain/shared/Result';
import { Notification } from '@/domain/notification/Notification';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import type { NotificationReader } from '@/domain/notification/NotificationReader';
import type { FindByUserIdOptions } from '@/domain/notification/NotificationReader';

export class PrismaNotificationReader implements NotificationReader {
  constructor(private readonly prisma: PrismaClient) {}

  async getUnreadCount(
    userId: UserId
  ): ReturnType<NotificationReader['getUnreadCount']> {
    let count;

    try {
      count = await this.prisma.notification.count({
        where: { userId, readAt: null },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    const parsed = NotificationCount.safeParse(count);

    return parsed.success
      ? success(parsed.data)
      : failure('common.errors.unexpected');
  }

  async getCountByUserId(
    userId: UserId
  ): ReturnType<NotificationReader['getCountByUserId']> {
    let count;

    try {
      count = await this.prisma.notification.count({ where: { userId } });
    } catch {
      return failure('common.errors.unexpected');
    }

    const parsed = NotificationCount.safeParse(count);

    return parsed.success
      ? success(parsed.data)
      : failure('common.errors.unexpected');
  }

  async findByUserId(
    userId: UserId,
    options?: FindByUserIdOptions
  ): ReturnType<NotificationReader['findByUserId']> {
    let rows;

    try {
      rows = await this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: options?.limit,
        skip: options?.offset,
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    const notifications: Notification[] = [];

    for (const row of rows) {
      const restored = Notification.restore(row);

      if (!restored.success) {
        return failure('common.errors.unexpected');
      }

      notifications.push(restored.value);
    }

    return success(notifications);
  }
}
