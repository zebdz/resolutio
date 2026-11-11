/** Prisma adapter for existing recipients' notification read/delete operations.
 * Query exceptions become Results, loaded rows are checked, and writes retain recipient filters. */
import type { PrismaClient } from '@/generated/prisma';
import type { NotificationId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { success, failure } from '@/domain/shared/Result';
import { Notification } from '@/domain/notification/Notification';
import type { NotificationRecipientRepository } from '@/domain/notification/NotificationRecipientRepository';

export class PrismaNotificationRecipientRepository implements NotificationRecipientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(
    id: NotificationId
  ): ReturnType<NotificationRecipientRepository['findById']> {
    let row;

    try {
      row = await this.prisma.notification.findUnique({ where: { id } });
    } catch {
      return failure('common.errors.unexpected');
    }

    if (row === null) {
      return success(null);
    }

    const restored = Notification.restore(row);

    return restored.success ? restored : failure('common.errors.unexpected');
  }

  async findByIds(
    ids: readonly NotificationId[]
  ): ReturnType<NotificationRecipientRepository['findByIds']> {
    if (ids.length === 0) {
      return success([]);
    }

    let rows;

    try {
      rows = await this.prisma.notification.findMany({
        where: { id: { in: [...ids] } },
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

  async markAsRead(
    id: NotificationId,
    recipientId: UserId,
    at: Instant
  ): ReturnType<NotificationRecipientRepository['markAsRead']> {
    try {
      await this.prisma.notification.updateMany({
        where: { id, userId: recipientId, readAt: null },
        data: { readAt: Instant.toDate(at) },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }

  async markAllAsRead(
    recipientId: UserId,
    at: Instant
  ): ReturnType<NotificationRecipientRepository['markAllAsRead']> {
    try {
      await this.prisma.notification.updateMany({
        where: { userId: recipientId, readAt: null },
        data: { readAt: Instant.toDate(at) },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }

  async deleteByIds(
    ids: readonly NotificationId[],
    recipientId: UserId
  ): ReturnType<NotificationRecipientRepository['deleteByIds']> {
    if (ids.length === 0) {
      return success(undefined);
    }

    try {
      await this.prisma.notification.deleteMany({
        where: { id: { in: [...ids] }, userId: recipientId },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }
}
