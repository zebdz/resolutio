// Escalating delays in seconds: 0, 60, 300, 1800, 3600, 7200
// Beyond index 5: double previous, cap at 86400 (24h)
const BASE_DELAYS = [0, 60, 300, 1800, 3600, 7200];
const MAX_DELAY = 86400; // 24 hours

/**
 * Calculate throttle delay in seconds based on number of recent OTPs
 * in a sliding 24h window.
 */
export function calculateThrottleDelay(recentCount: number): number {
  if (recentCount < BASE_DELAYS.length) {
    return BASE_DELAYS[recentCount];
  }

  // Beyond base delays: double previous, cap at 24h
  let delay = BASE_DELAYS[BASE_DELAYS.length - 1];

  for (let i = BASE_DELAYS.length; i <= recentCount; i++) {
    delay = Math.min(delay * 2, MAX_DELAY);
  }

  return delay;
}

/**
 * Check if enough time has passed since lastOtpCreatedAt given the delay.
 * Returns retryAfter in seconds (0 means allowed).
 */
export function getRetryAfter(
  recentCount: number,
  lastOtpCreatedAt: Date | null
): number {
  if (recentCount === 0 || !lastOtpCreatedAt) {
    return 0;
  }

  // The delay applies based on how many OTPs have been sent before this one
  const delay = calculateThrottleDelay(recentCount);

  if (delay === 0) {
    return 0;
  }

  const elapsedSeconds = (Date.now() - lastOtpCreatedAt.getTime()) / 1000;
  const remaining = Math.ceil(delay - elapsedSeconds);

  return remaining > 0 ? remaining : 0;
}
