'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { checkRateLimit } from '@/web/actions/rateLimit';
import {
  limiterRegistry,
  getLimiterByLabel,
} from '@/infrastructure/rateLimit/registry';

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
    phoneNumber: string;
  };
}

const userRepository = new PrismaUserRepository(prisma);

async function requireSuperadmin(): Promise<
  { userId: string } | { success: false; error: string }
> {
  const t = await getTranslations('common.errors');
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: t('unauthorized') };
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperAdmin) {
    return { success: false, error: t('unauthorized') };
  }

  return { userId: user.id };
}

function isError(
  result: { userId: string } | { success: false; error: string }
): result is { success: false; error: string } {
  return 'success' in result && result.success === false;
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

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: 'Invalid limiter label' };
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

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: 'Invalid limiter label' };
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

  if (input.query.length < 3) {
    return { success: false, error: 'Query must be at least 3 characters' };
  }

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: 'Invalid limiter label' };
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
  }

  // Merge and deduplicate
  const allKeys = new Set([...matchingKeys, ...additionalKeys]);
  const entries = entry.limiter.getEntries();
  const keySet = allKeys;
  const filtered = entries.filter((e) => keySet.has(e.key)).slice(0, 100);

  // Enrich user-keyed entries
  const enriched: EnrichedEntry[] = [];

  for (const e of filtered) {
    const enrichedEntry: EnrichedEntry = { ...e };
    const userIdMatch = e.key.match(/^user:(.+)$/);

    if (userIdMatch) {
      const users = await prisma.user.findMany({
        where: { id: userIdMatch[1] },
        select: {
          id: true,
          firstName: true,
          lastName: true,
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

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: 'Invalid limiter label' };
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

  const entry = getLimiterByLabel(input.label);

  if (!entry) {
    return { success: false, error: 'Invalid limiter label' };
  }

  entry.limiter.lockKey(input.key);

  console.log(
    `[RateLimitAdmin] ${new Date().toISOString()} lockKey label=${input.label} key=${input.key} by user=${auth.userId}`
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
