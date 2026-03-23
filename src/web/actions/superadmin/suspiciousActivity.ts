'use server';

import { getTranslations } from 'next-intl/server';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
import { SharedDomainCodes } from '@/domain/shared/SharedDomainCodes';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

const profanityChecker = LeoProfanityChecker.getInstance();
const userRepository = new PrismaUserRepository(prisma);

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

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
    middleName: string | null;
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

export interface SerializedAdminUserResult {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phoneNumber: string;
  nickname: string;
  createdAt: string;
  allowFindByName: boolean;
  allowFindByPhone: boolean;
  organizations: { id: string; name: string }[];
  organizationCount: number;
  pollCount: number;
  blockStatus: {
    blocked: boolean;
    reason?: string;
    blockedAt?: string;
  } | null;
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

async function getBlockedUserIds(): Promise<string[]> {
  return userRepository.getBlockedUserIds();
}

export async function getSuspiciousActivitySummaryAction(input: {
  page?: number;
  pageSize?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minBlocked?: number;
  maxBlocked?: number;
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

  // Build where clause from filters

  const whereAnd: any[] = [];

  if (input.search?.trim()) {
    const search = input.search.trim();
    // Find matching users by name/phone/nickname
    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { nickname: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    const userIds = matchingUsers.map((u) => u.id);

    const orConditions: any[] = [
      { key: { contains: search, mode: 'insensitive' } },
    ];

    if (userIds.length > 0) {
      orConditions.unshift({ userId: { in: userIds } });
    }

    whereAnd.push({ OR: orConditions });
  }

  if (input.dateFrom) {
    whereAnd.push({ createdAt: { gte: new Date(input.dateFrom) } });
  }

  if (input.dateTo) {
    whereAnd.push({
      createdAt: { lte: new Date(input.dateTo + 'T23:59:59.999Z') },
    });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  // Build having clause from min/max blocked

  let having: any = undefined;

  if (input.minBlocked || input.maxBlocked) {
    const countFilter: any = {};

    if (input.minBlocked) {
      countFilter.gte = input.minBlocked;
    }

    if (input.maxBlocked) {
      countFilter.lte = input.maxBlocked;
    }

    having = { id: { _count: countFilter } };
  }

  const [groupedEvents, totalCount] = await Promise.all([
    prisma.rateLimitEvent.groupBy({
      by: ['key', 'limiterLabel', 'userId'],
      _count: { id: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      ...(Object.keys(where).length > 0 ? { where } : {}),
      ...(having ? { having } : {}),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rateLimitEvent.count({
      ...(Object.keys(where).length > 0 ? { where } : {}),
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
            middleName: true,
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

  if (profanityChecker.containsProfanity(input.reason)) {
    const msg = await translateErrorCode(SharedDomainCodes.CONTAINS_PROFANITY);

    return {
      success: false,
      error: msg,
      fieldErrors: { reason: [msg] },
    };
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

  if (profanityChecker.containsProfanity(input.reason)) {
    const msg = await translateErrorCode(SharedDomainCodes.CONTAINS_PROFANITY);

    return {
      success: false,
      error: msg,
      fieldErrors: { reason: [msg] },
    };
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
  statusChangedBy: {
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
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
        select: { firstName: true, lastName: true, middleName: true },
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
    const tUsers = await getTranslations('superadmin.users');

    return { success: false, error: tUsers('searchMinChars') };
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

export async function listUsersForAdminAction(input: {
  page: number;
  pageSize: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  allowFindByName?: 'yes' | 'no';
  allowFindByPhone?: 'yes' | 'no';
  blockStatus?: 'blocked' | 'unblocked';
  organizationId?: string;
}): Promise<
  ActionResult<{
    users: SerializedAdminUserResult[];
    totalCount: number;
    totalPages: number;
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

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;

  // Build WHERE clauses
  const whereAnd: any[] = [];

  if (input.search?.trim()) {
    const search = input.search.trim();
    whereAnd.push({
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { middleName: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (input.dateFrom && !isNaN(Date.parse(input.dateFrom))) {
    whereAnd.push({ createdAt: { gte: new Date(input.dateFrom) } });
  }

  if (input.dateTo && !isNaN(Date.parse(input.dateTo))) {
    whereAnd.push({
      createdAt: { lte: new Date(input.dateTo + 'T23:59:59.999Z') },
    });
  }

  if (input.allowFindByName === 'yes') {
    whereAnd.push({ allowFindByName: true });
  } else if (input.allowFindByName === 'no') {
    whereAnd.push({ allowFindByName: false });
  }

  if (input.allowFindByPhone === 'yes') {
    whereAnd.push({ allowFindByPhone: true });
  } else if (input.allowFindByPhone === 'no') {
    whereAnd.push({ allowFindByPhone: false });
  }

  // Block status filter: get blocked user IDs, then filter
  if (input.blockStatus) {
    const blockedIds = await getBlockedUserIds();

    if (input.blockStatus === 'blocked') {
      whereAnd.push({
        id: { in: blockedIds.length > 0 ? blockedIds : ['__none__'] },
      });
    } else {
      if (blockedIds.length > 0) {
        whereAnd.push({ id: { notIn: blockedIds } });
      }
    }
  }

  // Organization filter: get member user IDs
  if (input.organizationId) {
    const members = await prisma.organizationUser.findMany({
      where: {
        organizationId: input.organizationId,
        status: 'accepted',
      },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    whereAnd.push({
      id: { in: memberIds.length > 0 ? memberIds : ['__none__'] },
    });
  }

  const where = whereAnd.length > 0 ? { AND: whereAnd } : {};

  // Fetch users + count in parallel
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        nickname: true,
        createdAt: true,
        allowFindByName: true,
        allowFindByPhone: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = users.map((u) => u.id);

  // Batch enrichment queries (only if there are users)
  const [blockStatuses, orgMemberships, pollCounts] =
    userIds.length > 0
      ? await Promise.all([
          // Latest block status per user
          prisma.userBlockStatus.findMany({
            where: { userId: { in: userIds } },
            orderBy: { createdAt: 'desc' },
            distinct: ['userId'],
            select: {
              userId: true,
              status: true,
              reason: true,
              createdAt: true,
            },
          }),
          // Org memberships
          prisma.organizationUser.findMany({
            where: { userId: { in: userIds }, status: 'accepted' },
            select: {
              userId: true,
              organization: { select: { id: true, name: true } },
            },
          }),
          // Poll participation counts (using poll_participants, the authoritative participation record)
          prisma.pollParticipant.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { _all: true },
          }),
        ])
      : [[], [], []];

  // Build lookup maps
  const blockStatusMap = new Map(
    blockStatuses.map((bs) => [
      bs.userId,
      bs.status === 'blocked'
        ? {
            blocked: true as const,
            reason: bs.reason ?? undefined,
            blockedAt: bs.createdAt.toISOString(),
          }
        : { blocked: false as const },
    ])
  );

  const orgMap = new Map<string, { id: string; name: string }[]>();

  for (const m of orgMemberships) {
    const existing = orgMap.get(m.userId) ?? [];
    existing.push(m.organization);
    orgMap.set(m.userId, existing);
  }

  const pollCountMap = new Map(
    pollCounts.map((pc) => [pc.userId, pc._count._all])
  );

  // Serialize
  const serializedUsers: SerializedAdminUserResult[] = users.map((user) => {
    const orgs = orgMap.get(user.id) ?? [];

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      phoneNumber: user.phoneNumber,
      nickname: user.nickname,
      createdAt: user.createdAt.toISOString(),
      allowFindByName: user.allowFindByName,
      allowFindByPhone: user.allowFindByPhone,
      organizations: orgs,
      organizationCount: orgs.length,
      pollCount: pollCountMap.get(user.id) ?? 0,
      blockStatus: blockStatusMap.get(user.id) ?? null,
    };
  });

  return {
    success: true,
    data: {
      users: serializedUsers,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}

export async function searchOrganizationsForFilterAction(input: {
  query: string;
}): Promise<ActionResult<{ id: string; name: string }[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  if (input.query.length < 2) {
    return { success: true, data: [] };
  }

  const orgs = await prisma.organization.findMany({
    where: {
      name: { contains: input.query, mode: 'insensitive' },
      archivedAt: null,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 20,
  });

  return { success: true, data: orgs };
}

export interface UserPollResult {
  id: string;
  title: string;
  state: string;
  createdAt: string;
  organizationId: string;
  organizationName: string;
}

const POLLS_PAGE_SIZE = 10;

export async function getUserPollsForAdminAction(input: {
  userId: string;
  page?: number;
}): Promise<ActionResult<{ polls: UserPollResult[]; totalCount: number }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  if (!input.userId) {
    return { success: true, data: { polls: [], totalCount: 0 } };
  }

  const page = input.page ?? 1;
  const offset = (page - 1) * POLLS_PAGE_SIZE;

  const [polls, totalCount] = await Promise.all([
    prisma.poll.findMany({
      where: { participants: { some: { userId: input.userId } } },
      select: {
        id: true,
        title: true,
        state: true,
        createdAt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: POLLS_PAGE_SIZE,
      skip: offset,
    }),
    prisma.pollParticipant.count({
      where: { userId: input.userId },
    }),
  ]);

  return {
    success: true,
    data: {
      polls: polls.map((p) => ({
        id: p.id,
        title: p.title,
        state: p.state,
        createdAt: p.createdAt.toISOString(),
        organizationId: p.organizationId,
        organizationName: p.organization.name,
      })),
      totalCount,
    },
  };
}

export async function getOrganizationNameAction(input: {
  organizationId: string;
}): Promise<ActionResult<{ id: string; name: string } | null>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  if (!input.organizationId) {
    return { success: true, data: null };
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });

  return { success: true, data: org };
}
