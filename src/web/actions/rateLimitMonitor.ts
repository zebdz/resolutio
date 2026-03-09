'use server';

import { checkRateLimit } from '@/web/actions/rateLimit';
import { limiterRegistry } from '@/infrastructure/rateLimit/registry';
import { requireSuperadmin } from '@/web/actions/superadminAuth';
import { isError } from '@/web/actions/superadminAuthUtils';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface MonitorEntry {
  key: string;
  limiterLabel: string;
  count: number;
  maxRequests: number;
  remaining: number;
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface KeyLimiterDetail {
  limiterLabel: string;
  count: number;
  maxRequests: number;
  remaining: number;
  blocked: boolean;
  retryAfterSeconds: number;
}

export async function getRateLimitMonitorSnapshotAction(filter?: {
  query?: string;
  label?: string;
}): Promise<ActionResult<MonitorEntry[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const limiters = filter?.label
    ? limiterRegistry.filter((e) => e.label === filter.label)
    : limiterRegistry;

  const entries: MonitorEntry[] = [];

  for (const reg of limiters) {
    for (const entry of reg.limiter.getEntries()) {
      entries.push({
        key: entry.key,
        limiterLabel: reg.label,
        count: entry.count,
        maxRequests: reg.maxRequests,
        remaining: entry.remaining,
        blocked: entry.blocked,
        retryAfterSeconds: entry.retryAfterSeconds,
      });
    }
  }

  // Filter by query substring (3+ chars)
  const query = filter?.query?.trim();
  const filtered =
    query && query.length >= 3
      ? entries.filter((e) => e.key.toLowerCase().includes(query.toLowerCase()))
      : entries;

  // Sort by count desc, limit 100
  filtered.sort((a, b) => b.count - a.count);

  return { success: true, data: filtered.slice(0, 100) };
}

export async function getKeyLimiterDetailsAction(input: {
  key: string;
}): Promise<ActionResult<KeyLimiterDetail[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const details: KeyLimiterDetail[] = [];

  for (const reg of limiterRegistry) {
    const result = reg.limiter.peek(input.key);
    const entries = reg.limiter.getEntries();
    const entry = entries.find((e) => e.key === input.key);
    const count = entry?.count ?? 0;
    const blocked = !result.allowed;

    // Only include limiters where this key actually has activity
    if (count > 0 || blocked) {
      details.push({
        limiterLabel: reg.label,
        count,
        maxRequests: reg.maxRequests,
        remaining: result.remaining,
        blocked,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }
  }

  return { success: true, data: details };
}
