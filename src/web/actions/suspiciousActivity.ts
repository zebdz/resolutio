'use server';

import { getTranslations } from 'next-intl/server';
import { prisma } from '@/infrastructure/index';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/web/actions/superadminAuth';
import { isError } from '@/web/actions/superadminAuthUtils';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface SuspiciousKeySummary {
  key: string;
  userId: string | null;
  limiterLabel: string;
  totalEvents: number;
  firstEventAt: Date;
  lastEventAt: Date;
  resolvedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  blockStatus?: { blocked: boolean; reason?: string; blockedAt?: Date } | null;
}

export interface AdminUserResult {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string;
  nickname: string;
  createdAt: Date;
  blockStatus: { blocked: boolean; reason?: string; blockedAt?: Date } | null;
}

async function getBlockStatusForUser(
  userId: string
): Promise<{ blocked: boolean; reason?: string; blockedAt?: Date } | null> {
  const latest = await prisma.userBlockStatus.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { status: true, reason: true, createdAt: true },
  });

  if (!latest) {
    return null;
  }

  if (latest.status === 'blocked') {
    return {
      blocked: true,
      reason: latest.reason ?? undefined,
      blockedAt: latest.createdAt,
    };
  }

  return { blocked: false };
}

export async function getSuspiciousActivitySummaryAction(input: {
  page?: number;
  pageSize?: number;
}): Promise<
  ActionResult<{ items: SuspiciousKeySummary[]; totalCount: number }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  const [groupedEvents, totalCount] = await Promise.all([
    prisma.rateLimitEvent.groupBy({
      by: ['key', 'limiterLabel', 'userId'],
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rateLimitEvent.count({
      // Count distinct key+limiterLabel combos (approximate via raw count)
    }),
  ]);

  // Resolve users for userId-containing entries
  const userIds = groupedEvents
    .map((e) => e.userId)
    .filter((id): id is string => id !== null);
  const uniqueUserIds = [...new Set(userIds)];

  const users =
    uniqueUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
          },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build summaries
  const items: SuspiciousKeySummary[] = await Promise.all(
    groupedEvents.map(async (event) => {
      const summary: SuspiciousKeySummary = {
        key: event.key,
        userId: event.userId,
        limiterLabel: event.limiterLabel,
        totalEvents: event._count.id,
        firstEventAt: event._min.createdAt!,
        lastEventAt: event._max.createdAt!,
      };

      if (event.userId) {
        const user = userMap.get(event.userId);

        if (user) {
          summary.resolvedUser = user;
        }

        summary.blockStatus = await getBlockStatusForUser(event.userId);
      }

      return summary;
    })
  );

  return { success: true, data: { items, totalCount } };
}

export async function getSuspiciousActivityForKeyAction(input: {
  key: string;
}): Promise<
  ActionResult<{
    events: Array<{
      id: string;
      key: string;
      limiterLabel: string;
      userId: string | null;
      createdAt: Date;
    }>;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const events = await prisma.rateLimitEvent.findMany({
    where: { key: input.key },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      key: true,
      limiterLabel: true,
      userId: true,
      createdAt: true,
    },
  });

  return { success: true, data: { events } };
}

export async function blockUserAction(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const t = await getTranslations('superadmin.users');

  if (!input.reason.trim()) {
    return { success: false, error: t('reasonRequired') };
  }

  await prisma.userBlockStatus.create({
    data: {
      userId: input.userId,
      status: 'blocked',
      statusChangedBySuperadminId: auth.userId,
      reason: input.reason,
    },
  });

  console.log(
    `[UserBlock] ${new Date().toISOString()} blocked userId=${input.userId} reason="${input.reason}" by superadmin=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function unblockUserAction(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const t = await getTranslations('superadmin.users');

  if (!input.reason.trim()) {
    return { success: false, error: t('reasonRequired') };
  }

  await prisma.userBlockStatus.create({
    data: {
      userId: input.userId,
      status: 'unblocked',
      statusChangedBySuperadminId: auth.userId,
      reason: input.reason,
    },
  });

  console.log(
    `[UserBlock] ${new Date().toISOString()} unblocked userId=${input.userId} reason="${input.reason}" by superadmin=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function getUserBlockStatusAction(input: {
  userId: string;
}): Promise<
  ActionResult<{ blocked: boolean; reason?: string; blockedAt?: Date }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const status = await getBlockStatusForUser(input.userId);

  return { success: true, data: status ?? { blocked: false } };
}

export interface UserBlockHistoryEntry {
  id: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  statusChangedBy: { firstName: string; lastName: string };
}

export async function getUserBlockHistoryAction(input: {
  userId: string;
}): Promise<ActionResult<UserBlockHistoryEntry[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const history = await prisma.userBlockStatus.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      reason: true,
      createdAt: true,
      statusChangedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return { success: true, data: history };
}

export async function searchUsersForAdminAction(input: {
  query: string;
}): Promise<ActionResult<AdminUserResult[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  if (input.query.length < 3) {
    return { success: false, error: 'Query must be at least 3 characters' };
  }

  // Search by name/nickname/phone
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: input.query, mode: 'insensitive' } },
        { lastName: { contains: input.query, mode: 'insensitive' } },
        { middleName: { contains: input.query, mode: 'insensitive' } },
        { nickname: { contains: input.query, mode: 'insensitive' } },
        { phoneNumber: { contains: input.query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phoneNumber: true,
      nickname: true,
      createdAt: true,
    },
    take: 50,
  });

  // Attach block status for each
  const results: AdminUserResult[] = await Promise.all(
    users.map(async (user) => ({
      ...user,
      blockStatus: await getBlockStatusForUser(user.id),
    }))
  );

  return { success: true, data: results };
}
