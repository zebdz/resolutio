/** Deterministic resend policy evaluates typed counts at caller-supplied time.
 * Existing tiers and the 24-hour ceiling remain unchanged. */
import { Seconds } from '../auth/AuthValues';
import { Instant } from '../shared/Instant';
import { OtpCount } from './OtpValues';

// Escalating delays in seconds: 0, 60, 300, 1800, 3600, 7200.
// Later tiers double the previous delay, capped at 86400 (24 hours).
const BASE_DELAYS = [0, 60, 300, 1800, 3600, 7200];
const MAX_DELAY = 86400;

export function calculateThrottleDelay(recentCount: OtpCount): Seconds {
  OtpCount.parse(recentCount);

  if (recentCount < BASE_DELAYS.length) {
    return Seconds.parse(BASE_DELAYS[recentCount]);
  }

  return Seconds.parse(
    Math.min(
      BASE_DELAYS.at(-1)! * 2 ** (recentCount - BASE_DELAYS.length + 1),
      MAX_DELAY
    )
  );
}

/** Seconds remaining until the tier permits another code; zero means now. */
export function getRetryAfter(
  recentCount: OtpCount,
  lastOtpCreatedAt: Instant | null,
  now: Instant
): Seconds {
  if (recentCount === 0 || lastOtpCreatedAt === null) {
    return Seconds.parse(0);
  }

  const elapsedSeconds =
    (Instant.toDate(now).getTime() -
      Instant.toDate(lastOtpCreatedAt).getTime()) /
    1000;
  const remaining = Math.ceil(
    calculateThrottleDelay(recentCount) - elapsedSeconds
  );

  return Seconds.parse(Math.max(remaining, 0));
}
