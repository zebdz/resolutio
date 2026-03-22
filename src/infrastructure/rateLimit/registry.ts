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

// 120 / min
const MIDDLEWARE_SESSION_MAX = 120;
const MIDDLEWARE_SESSION_WINDOW_MS = 60_000;

// 50_000 / min
const MIDDLEWARE_IP_MAX = 50_000;
const MIDDLEWARE_IP_WINDOW_MS = 60_000;

// 200 / min
const SERVER_ACTION_SESSION_MAX = 200;
const SERVER_ACTION_SESSION_WINDOW_MS = 60_000;

// 200_000 / min
const SERVER_ACTION_IP_MAX = 200_000;
const SERVER_ACTION_IP_WINDOW_MS = 60_000;

// 5 / 30 min
const PHONE_SEARCH_MAX = 5;
const PHONE_SEARCH_WINDOW_MS = 30 * 60_000;

// 5 / 15 min
const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

// 5000 / 1 hour
const REGISTRATION_IP_MAX = 5_000;
const REGISTRATION_IP_WINDOW_MS = 60 * 60_000;

// 3 / 1 hour
const REGISTRATION_DEVICE_MAX = 3;
const REGISTRATION_DEVICE_WINDOW_MS = 60 * 60_000;

function createRegistry(): LimiterEntry[] {
  return [
    {
      label: 'middlewareSession',
      limiter: new InMemoryRateLimiter(
        MIDDLEWARE_SESSION_MAX,
        MIDDLEWARE_SESSION_WINDOW_MS
      ),
      maxRequests: MIDDLEWARE_SESSION_MAX,
      windowMs: MIDDLEWARE_SESSION_WINDOW_MS,
    },
    {
      label: 'middlewareIp',
      limiter: new InMemoryRateLimiter(
        MIDDLEWARE_IP_MAX,
        MIDDLEWARE_IP_WINDOW_MS
      ),
      maxRequests: MIDDLEWARE_IP_MAX,
      windowMs: MIDDLEWARE_IP_WINDOW_MS,
    },
    {
      label: 'serverActionSession',
      limiter: new InMemoryRateLimiter(
        SERVER_ACTION_SESSION_MAX,
        SERVER_ACTION_SESSION_WINDOW_MS
      ),
      maxRequests: SERVER_ACTION_SESSION_MAX,
      windowMs: SERVER_ACTION_SESSION_WINDOW_MS,
    },
    {
      label: 'serverActionIp',
      limiter: new InMemoryRateLimiter(
        SERVER_ACTION_IP_MAX,
        SERVER_ACTION_IP_WINDOW_MS
      ),
      maxRequests: SERVER_ACTION_IP_MAX,
      windowMs: SERVER_ACTION_IP_WINDOW_MS,
    },
    {
      label: 'phoneSearch',
      limiter: new InMemoryRateLimiter(
        PHONE_SEARCH_MAX,
        PHONE_SEARCH_WINDOW_MS
      ),
      maxRequests: PHONE_SEARCH_MAX,
      windowMs: PHONE_SEARCH_WINDOW_MS,
    },
    {
      label: 'login',
      limiter: new InMemoryRateLimiter(LOGIN_MAX, LOGIN_WINDOW_MS),
      maxRequests: LOGIN_MAX,
      windowMs: LOGIN_WINDOW_MS,
    },
    {
      label: 'registrationIp',
      limiter: new InMemoryRateLimiter(
        REGISTRATION_IP_MAX,
        REGISTRATION_IP_WINDOW_MS
      ),
      maxRequests: REGISTRATION_IP_MAX,
      windowMs: REGISTRATION_IP_WINDOW_MS,
    },
    {
      label: 'registrationDevice',
      limiter: new InMemoryRateLimiter(
        REGISTRATION_DEVICE_MAX,
        REGISTRATION_DEVICE_WINDOW_MS
      ),
      maxRequests: REGISTRATION_DEVICE_MAX,
      windowMs: REGISTRATION_DEVICE_WINDOW_MS,
    },
  ];
}

export const limiterRegistry: LimiterEntry[] =
  globalForRateLimit.limiterRegistry ?? createRegistry();

globalForRateLimit.limiterRegistry = limiterRegistry;

// Derive named exports from the shared registry
export const middlewareSessionLimiter = limiterRegistry[0].limiter;
export const middlewareIpLimiter = limiterRegistry[1].limiter;
export const serverActionSessionLimiter = limiterRegistry[2].limiter;
export const serverActionIpLimiter = limiterRegistry[3].limiter;
export const phoneSearchLimiter = limiterRegistry[4].limiter;
export const loginLimiter = limiterRegistry[5].limiter;
export const registrationIpLimiter = limiterRegistry[6].limiter;
export const registrationDeviceLimiter = limiterRegistry[7].limiter;

export function getLimiterByLabel(label: string): LimiterEntry | undefined {
  return limiterRegistry.find((entry) => entry.label === label);
}

// Wire suspicious activity recording on all limiters — once
if (!globalForRateLimit.suspiciousActivityWired) {
  setupSuspiciousActivityRecording(limiterRegistry);
  globalForRateLimit.suspiciousActivityWired = true;
}
