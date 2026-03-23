'use server';

import { getTranslations } from 'next-intl/server';
import { prisma } from '@/infrastructure/index';
import { checkRateLimit } from '@/web/actions/rateLimit';
import {
  limiterRegistry,
  getLimiterByLabel,
} from '@/infrastructure/rateLimit/registry';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface LimiterOverview {
  label: string;
  maxRequests: number;
  windowMs: number;
  entryCount: number;
  blockedCount: number;
}

export interface EnrichedEntry {
  key: string;
  count: number;
  remaining: number;
  blocked: boolean;
  retryAfterSeconds: number;
  resolvedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phoneNumber: string;
  };
}

export async function getRateLimitOverviewAction(): Promise<
  ActionResult<LimiterOverview[]>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const data: LimiterOverview[] = limiterRegistry.map((entry) => ({
    label: entry.label,
    maxRequests: entry.maxRequests,
    windowMs: entry.windowMs,
    entryCount: entry.limiter.size,
    blockedCount: entry.limiter.getBlockedKeys().length,
  }));

  return { success: true, data };
}

export async function resetAllRateLimitsAction(): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  for (const entry of limiterRegistry) {
    entry.limiter.clearAll();
  }

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} resetAll by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function resetLimiterAction(input: {
  label: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');
  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  entry.limiter.clearAll();

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} resetLimiter label=${input.label} by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function clearBlockedKeysAction(input: {
  label: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');
  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  const blockedKeys = entry.limiter.getBlockedKeys();
  entry.limiter.resetKeys(blockedKeys);

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} clearBlocked label=${input.label} count=${blockedKeys.length} by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function searchRateLimitEntriesAction(input: {
  label: string;
  query: string;
}): Promise<ActionResult<EnrichedEntry[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');

  if (input.query.length < 3) {
    return { success: false, error: tRL('searchMinChars') };
  }

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  // Raw key search
  const matchingKeys = entry.limiter.searchKeys(input.query);

  // For user-keyed limiters, also search users by name/nickname/phone
  const additionalKeys = new Set<string>();

  if (input.label === 'phoneSearch') {
    const users = await searchUsersByQuery(input.query);

    for (const u of users) {
      const key = `user:${u.id}`;
      additionalKeys.add(key);
    }
  } else if (input.label === 'login') {
    const users = await searchUsersByPhone(input.query);

    for (const u of users) {
      const allKeys = entry.limiter.searchKeys(u.phoneNumber);

      for (const k of allKeys) {
        additionalKeys.add(k);
      }
    }
  } else if (
    input.label === 'middlewareSession' ||
    input.label === 'serverActionSession'
  ) {
    const users = await searchUsersByQuery(input.query);
    const userIds = users.map((u) => u.id);

    if (userIds.length > 0) {
      const sessions = await prisma.session.findMany({
        where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      const prefix =
        input.label === 'middlewareSession' ? 'mw-session:' : 'session:';

      for (const s of sessions) {
        additionalKeys.add(`${prefix}${s.id}`);
      }
    }
  }

  // Merge and deduplicate
  const allKeys = new Set([...matchingKeys, ...additionalKeys]);
  const entries = entry.limiter.getEntries();
  const keySet = allKeys;
  const filtered = entries.filter((e) => keySet.has(e.key)).slice(0, 100);

  // Enrich user-keyed entries
  const enriched: EnrichedEntry[] = [];

  // Batch-resolve session-keyed entries to users
  const sessionKeyPattern = /^(?:mw-session|session):(.+)$/;
  const sessionIds = filtered
    .map((e) => e.key.match(sessionKeyPattern)?.[1])
    .filter((id): id is string => !!id);

  const sessionUserMap = new Map<string, string>();

  if (sessionIds.length > 0) {
    const sessions = await prisma.session.findMany({
      where: { id: { in: sessionIds } },
      select: { id: true, userId: true },
    });

    for (const s of sessions) {
      sessionUserMap.set(s.id, s.userId);
    }
  }

  for (const e of filtered) {
    const enrichedEntry: EnrichedEntry = { ...e };
    const userIdMatch = e.key.match(/^user:(.+)$/);
    const sessionMatch = e.key.match(sessionKeyPattern);

    const resolveUserId =
      userIdMatch?.[1] ??
      (sessionMatch ? sessionUserMap.get(sessionMatch[1]) : undefined);

    if (resolveUserId) {
      const users = await prisma.user.findMany({
        where: { id: resolveUserId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          phoneNumber: true,
        },
        take: 1,
      });

      if (users.length > 0) {
        enrichedEntry.resolvedUser = users[0];
      }
    }

    enriched.push(enrichedEntry);
  }

  return { success: true, data: enriched };
}

export async function resetRateLimitKeysAction(input: {
  label: string;
  keys: string[];
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');
  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  entry.limiter.resetKeys(input.keys);

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} resetKeys label=${input.label} keys=${input.keys.join(',')} by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function lockRateLimitKeyAction(input: {
  label: string;
  key: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');
  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  entry.limiter.lockKey(input.key);

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} lockKey label=${input.label} key=${input.key} by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

export async function unlockRateLimitKeyAction(input: {
  label: string;
  key: string;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const tRL = await getTranslations('superadmin.rateLimits');
  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: tRL('invalidLimiterLabel') };
  }

  entry.limiter.resetKeys([input.key]);

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} unlockKey label=${input.label} key=${input.key} by user=${auth.userId}`
  );

  return { success: true, data: undefined };
}

async function searchUsersByPhone(query: string) {
  return prisma.user.findMany({
    where: { phoneNumber: { contains: query, mode: 'insensitive' } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phoneNumber: true,
    },
    take: 20,
  });
}

async function searchUsersByQuery(query: string) {
  const [byName, byPhone] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { nickname: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
      },
      take: 20,
    }),
    searchUsersByPhone(query),
  ]);

  const seen = new Set<string>();
  const result: typeof byName = [];

  for (const u of [...byName, ...byPhone]) {
    if (!seen.has(u.id)) {
      seen.add(u.id);
      result.push(u);
    }
  }

  return result;
}
