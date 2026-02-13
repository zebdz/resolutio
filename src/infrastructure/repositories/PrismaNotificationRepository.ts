import {
  PrismaClient,
  Prisma,
  Notification as PrismaNotification,
} from '@/generated/prisma';
import {
  NotificationRepository,
  FindByUserIdOptions,
} from '../../domain/notification/NotificationRepository';
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
    data: row.data as Record<string, unknown> | null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private prisma: PrismaClient) {}

  async save(notification: Notification): Promise<Notification> {
    const json = notification.toJSON();
    const row = await this.prisma.notification.create({
      data: {
        userId: json.userId,
        type: json.type,
        title: json.title,
        body: json.body,
        data: (json.data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        readAt: json.readAt,
      },
    });

    return Notification.reconstitute(toProps(row));
  }

  async saveBatch(notifications: Notification[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: notifications.map((n) => {
        const json = n.toJSON();

        return {
          userId: json.userId,
          type: json.type,
          title: json.title,
          body: json.body,
          data: (json.data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          readAt: json.readAt,
        };
      }),
    });
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await this.prisma.notification.findUnique({ where: { id } });

    return row ? Notification.reconstitute(toProps(row)) : null;
  }

  async findByUserId(
    userId: string,
    options?: FindByUserIdOptions
  ): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });

    return rows.map((row) => Notification.reconstitute(toProps(row)));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(id: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async findByIds(ids: string[]): Promise<Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { id: { in: ids } },
    });

    return rows.map((row) => Notification.reconstitute(toProps(row)));
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: { id: { in: ids } },
    });
  }

  async getCountByUserId(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId } });
  }
}
