import { InMemoryRateLimiter } from './InMemoryRateLimiter';

export const MIDDLEWARE_RATE_LIMIT = 60;
const MIDDLEWARE_WINDOW_MS = 60_000;

export const rateLimiter = new InMemoryRateLimiter(
  MIDDLEWARE_RATE_LIMIT,
  MIDDLEWARE_WINDOW_MS
);

export {
  InMemoryRateLimiter,
  type RateLimitResult,
} from './InMemoryRateLimiter';
export { extractIpFromRequest } from './extractIp';
