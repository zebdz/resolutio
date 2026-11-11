/** Producer persistence appends supplied identities/time and returns explicit storage outcomes.
 * Query catches only wrap Prisma I/O; checked restoration happens outside the throwing boundary. */
import { success, failure } from '@/domain/shared/Result';
import {
  PrismaClient,
  Notification as PrismaNotification,
} from '@/generated/prisma';
import type { NotificationRepository } from '@/domain/notification/NotificationRepository';
import {
  Notification,
  NotificationProps,
} from '../../domain/notification/Notification';

function toProps(row: PrismaNotification): NotificationProps {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    notification: Notification
  ): ReturnType<NotificationRepository['save']> {
    const json = notification.toJSON();
    const data = {
      id: json.id,
      createdAt: json.createdAt,
      userId: json.userId,
      type: json.type,
      title: json.title,
      body: json.body,
      data: json.data,
      readAt: json.readAt,
    };
    let row;

    try {
      row = await this.prisma.notification.create({ data });
    } catch {
      return failure('common.errors.unexpected');
    }

    const restored = Notification.restore(toProps(row));

    return restored.success ? restored : failure('common.errors.unexpected');
  }

  async saveBatch(
    notifications: Notification[]
  ): ReturnType<NotificationRepository['saveBatch']> {
    if (notifications.length === 0) {
      return success(undefined);
    }

    const data = notifications.map((n) => {
      const json = n.toJSON();

      return {
        id: json.id,
        createdAt: json.createdAt,
        userId: json.userId,
        type: json.type,
        title: json.title,
        body: json.body,
        data: json.data,
        readAt: json.readAt,
      };
    });

    try {
      await this.prisma.notification.createMany({ data });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }
}
