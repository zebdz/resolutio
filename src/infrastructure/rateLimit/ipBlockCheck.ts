import { prisma } from '@/infrastructure/database/prisma';
import { IpBlockRepository } from '@/infrastructure/repositories/IpBlockRepository';

const REFRESH_INTERVAL_MS = 60_000; // 60 seconds

interface IpBlockGlobal {
  ipBlockCache:
    | {
        blockedIps: Set<string>;
        lastRefreshAt: number;
        refreshPromise: Promise<void> | null;
      }
    | undefined;
}

const globalForIpBlock = globalThis as unknown as IpBlockGlobal;

const cache = (globalForIpBlock.ipBlockCache ??= {
  blockedIps: new Set<string>(),
  lastRefreshAt: 0,
  refreshPromise: null,
});

if (process.env.NODE_ENV !== 'production') {
  globalForIpBlock.ipBlockCache = cache;
}

const repo = new IpBlockRepository(prisma);

/**
 * Synchronous check — used in middleware (must be fast).
 * Returns true if IP is in the blocked set.
 * Triggers async refresh if cache is stale.
 */
export function isIpBlocked(ip: string): boolean {
  // Trigger background refresh if stale
  if (
    Date.now() - cache.lastRefreshAt > REFRESH_INTERVAL_MS &&
    !cache.refreshPromise
  ) {
    cache.refreshPromise = refreshBlockedIps().finally(() => {
      cache.refreshPromise = null;
    });
  }

  return cache.blockedIps.has(ip);
}

/**
 * Refresh the in-memory cache from DB.
 */
export async function refreshBlockedIps(): Promise<void> {
  const ips = await repo.getAllBlockedIps();
  cache.blockedIps = new Set(ips);
  cache.lastRefreshAt = Date.now();
}

/**
 * Mark cache as stale so next check triggers refresh.
 * Called after block/unblock mutations.
 */
export function invalidateIpBlockCache(): void {
  cache.lastRefreshAt = 0;
  cache.blockedIps = new Set<string>();
}
