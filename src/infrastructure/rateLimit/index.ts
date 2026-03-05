import { InMemoryRateLimiter } from './InMemoryRateLimiter';

export const rateLimiter = new InMemoryRateLimiter(60, 60_000);

export {
  InMemoryRateLimiter,
  type RateLimitResult,
} from './InMemoryRateLimiter';
export { extractIpFromRequest } from './extractIp';
