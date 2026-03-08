import { prisma } from '@/infrastructure/database/prisma';

import type { LimiterEntry } from './registry';

const USER_KEY_PATTERN = /^user:(.+)$/;

export function extractUserIdFromKey(
  key: string,
  label: string
): string | null {
  if (label === 'phoneSearch') {
    const match = key.match(USER_KEY_PATTERN);

    return match ? match[1] : null;
  }

  return null;
}

export function setupSuspiciousActivityRecording(
  registry: LimiterEntry[]
): void {
  for (const entry of registry) {
    entry.limiter.onBlocked = (key: string) => {
      const userId = extractUserIdFromKey(key, entry.label);

      prisma.rateLimitEvent
        .create({
          data: {
            key,
            limiterLabel: entry.label,
            userId,
          },
        })
        .catch((err: unknown) => {
          console.error(
            `[SuspiciousActivity] Failed to log event for key=${key} limiter=${entry.label}:`,
            err
          );
        });
    };
  }
}
