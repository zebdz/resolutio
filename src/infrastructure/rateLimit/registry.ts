import { InMemoryRateLimiter } from './InMemoryRateLimiter';
import { setupSuspiciousActivityRecording } from './suspiciousActivityRecorder';

export interface LimiterEntry {
  label: string;
  limiter: InMemoryRateLimiter;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitGlobal {
  limiterRegistry: LimiterEntry[] | undefined;
  suspiciousActivityWired: boolean | undefined;
}

const globalForRateLimit = globalThis as unknown as RateLimitGlobal;

function createRegistry(): LimiterEntry[] {
  // Middleware: 60 req / 1 min
  const middlewareLimiterInstance = new InMemoryRateLimiter(60, 60_000);

  // Server actions: 200 req / 1 min
  const serverActionLimiterInstance = new InMemoryRateLimiter(200, 60_000);

  // Phone search: 5 req / 30 min
  const phoneSearchLimiterInstance = new InMemoryRateLimiter(5, 30 * 60_000);

  // Login: 5 req / 15 min
  const loginLimiterInstance = new InMemoryRateLimiter(5, 15 * 60_000);

  // Registration IP: 50 req / 1 hour
  const registrationIpLimiterInstance = new InMemoryRateLimiter(
    50,
    60 * 60_000
  );

  // Registration device: 3 req / 1 hour
  const registrationDeviceLimiterInstance = new InMemoryRateLimiter(
    3,
    60 * 60_000
  );

  return [
    {
      label: 'middleware',
      limiter: middlewareLimiterInstance,
      maxRequests: 60,
      windowMs: 60_000,
    },
    {
      label: 'serverAction',
      limiter: serverActionLimiterInstance,
      maxRequests: 200,
      windowMs: 60_000,
    },
    {
      label: 'phoneSearch',
      limiter: phoneSearchLimiterInstance,
      maxRequests: 5,
      windowMs: 30 * 60_000,
    },
    {
      label: 'login',
      limiter: loginLimiterInstance,
      maxRequests: 5,
      windowMs: 15 * 60_000,
    },
    {
      label: 'registrationIp',
      limiter: registrationIpLimiterInstance,
      maxRequests: 50,
      windowMs: 60 * 60_000,
    },
    {
      label: 'registrationDevice',
      limiter: registrationDeviceLimiterInstance,
      maxRequests: 3,
      windowMs: 60 * 60_000,
    },
  ];
}

export const limiterRegistry: LimiterEntry[] =
  globalForRateLimit.limiterRegistry ?? createRegistry();

if (process.env.NODE_ENV !== 'production') {
  globalForRateLimit.limiterRegistry = limiterRegistry;
}

// Derive named exports from the shared registry
export const middlewareLimiter = limiterRegistry[0].limiter;
export const serverActionLimiter = limiterRegistry[1].limiter;
export const phoneSearchLimiter = limiterRegistry[2].limiter;
export const loginLimiter = limiterRegistry[3].limiter;
export const registrationIpLimiter = limiterRegistry[4].limiter;
export const registrationDeviceLimiter = limiterRegistry[5].limiter;

export function getLimiterByLabel(label: string): LimiterEntry | undefined {
  return limiterRegistry.find((entry) => entry.label === label);
}

// Wire suspicious activity recording on all limiters — once
if (!globalForRateLimit.suspiciousActivityWired) {
  setupSuspiciousActivityRecording(limiterRegistry);
  globalForRateLimit.suspiciousActivityWired = true;
}
