'use server';

import { getTranslations } from 'next-intl/server';
import { getClientIp } from '@/web/lib/clientIp';
import { InMemoryRateLimiter } from '@/infrastructure/rateLimit/InMemoryRateLimiter';

const limiter = new InMemoryRateLimiter(200, 60_000);

/**
 * Check rate limit for the current request's IP.
 * Returns a failed ActionResult if rate-limited, null otherwise.
 *
 * Usage (at the top of every server action):
 *   const rateLimited = await checkRateLimit();
 *   if (rateLimited) return rateLimited;
 */
export async function checkRateLimit(): Promise<{
  success: false;
  error: string;
} | null> {
  const ip = await getClientIp();
  const result = limiter.check(ip);

  if (!result.allowed) {
    const t = await getTranslations('rateLimit');

    return { success: false, error: t('tooManyRequests') };
  }

  return null;
}
