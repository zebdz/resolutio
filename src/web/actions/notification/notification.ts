'use server';

/** Notification actions authorize recipients and preserve typed event payloads/counts.
 * Result-based reads/mutations propagate localized failures; explicit mapping filters server fields. */

import {
  serializeNotification,
  type NotificationView,
} from './serializeNotification';
import type { NotificationCount } from '@/domain/notification/NotificationContent';
import { SystemClock } from '@/infrastructure/shared/SystemEntityCreation';
import { getTranslations } from 'next-intl/server';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { GetNotificationsUseCase } from '@/application/notification/GetNotificationsUseCase';
import { MarkNotificationReadUseCase } from '@/application/notification/MarkNotificationReadUseCase';
import { MarkAllNotificationsReadUseCase } from '@/application/notification/MarkAllNotificationsReadUseCase';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { DeleteNotificationsUseCase } from '@/application/notification/DeleteNotificationsUseCase';
import { prisma } from '@/infrastructure/index';
import { PrismaNotificationReader } from '@/infrastructure/repositories/PrismaNotificationReader';
import { PrismaNotificationRecipientRepository } from '@/infrastructure/repositories/PrismaNotificationRecipientRepository';
import { getCurrentUser } from '../../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { ActionResult } from '../organization/organization';

const notificationRepository = new PrismaNotificationRecipientRepository(
  prisma
);
const notificationReader = new PrismaNotificationReader(prisma);

const getNotificationsUseCase = new GetNotificationsUseCase({
  notificationReader,
});

const markNotificationReadUseCase = new MarkNotificationReadUseCase({
  clock: new SystemClock(),
  notificationRepository,
});

const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase({
  clock: new SystemClock(),
  notificationRepository,
});

const getUnreadNotificationCountUseCase = new GetUnreadNotificationCountUseCase(
  {
    notificationReader,
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
    notifications: NotificationView[];
    unreadCount: NotificationCount;
    totalCount: NotificationCount;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return {
      success: true,
      data: {
        notifications: result.value.notifications.map(serializeNotification),
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error marking notification as read:', error);

    return { success: false, error: t('generic') };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getUnreadNotificationCountAction(): Promise<
  ActionResult<{ count: NotificationCount }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
      return { success: false, error: await translateErrorCode(result.error) };
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting notifications:', error);

    return { success: false, error: t('generic') };
  }
}
