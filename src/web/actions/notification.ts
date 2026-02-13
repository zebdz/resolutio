'use server';

import { getTranslations } from 'next-intl/server';
import { GetNotificationsUseCase } from '@/application/notification/GetNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@/application/notification/MarkNotificationReadUseCase';
import { MarkAllNotificationsReadUseCase } from '@/application/notification/MarkAllNotificationsReadUseCase';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { DeleteNotificationsUseCase } from '@/application/notification/DeleteNotificationsUseCase';
import { prisma, PrismaNotificationRepository } from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';
import { ActionResult } from './organization';

const notificationRepository = new PrismaNotificationRepository(prisma);

const getNotificationsUseCase = new GetNotificationsUseCase({
  notificationRepository,
});

const markNotificationReadUseCase = new MarkNotificationReadUseCase({
  notificationRepository,
});

const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase({
  notificationRepository,
});

const getUnreadNotificationCountUseCase = new GetUnreadNotificationCountUseCase(
  {
    notificationRepository,
  }
);

const deleteNotificationsUseCase = new DeleteNotificationsUseCase({
  notificationRepository,
});

export async function getNotificationsAction(
  limit?: number,
  offset?: number
): Promise<
  ActionResult<{
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      body: string;
      data: Record<string, unknown> | null;
      readAt: Date | null;
      createdAt: Date;
    }>;
    unreadCount: number;
    totalCount: number;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getNotificationsUseCase.execute({
      userId: user.id,
      limit,
      offset,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        notifications: result.value.notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          data: n.data,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        unreadCount: result.value.unreadCount,
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error getting notifications:', error);

    return { success: false, error: t('generic') };
  }
}

export async function markNotificationReadAction(
  notificationId: string
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await markNotificationReadUseCase.execute({
      notificationId,
      userId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error marking notification as read:', error);

    return { success: false, error: t('generic') };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await markAllNotificationsReadUseCase.execute({
      userId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getUnreadNotificationCountAction(): Promise<
  ActionResult<{ count: number }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getUnreadNotificationCountUseCase.execute({
      userId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.value };
  } catch (error) {
    console.error('Error getting unread notification count:', error);

    return { success: false, error: t('generic') };
  }
}

export async function deleteNotificationsAction(
  notificationIds: string[]
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await deleteNotificationsUseCase.execute({
      notificationIds,
      userId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting notifications:', error);

    return { success: false, error: t('generic') };
  }
}
