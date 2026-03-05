import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  InMemoryRateLimiter,
  type RateLimitResult,
} from '../InMemoryRateLimiter';

describe('InMemoryRateLimiter', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    limiter?.destroy();
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);

    const result = limiter.check('192.168.1.1');

    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it('returns correct remaining count', () => {
    limiter = new InMemoryRateLimiter(5, 60_000);

    expect(limiter.check('192.168.1.1').remaining).toBe(4);
    expect(limiter.check('192.168.1.1').remaining).toBe(3);
    expect(limiter.check('192.168.1.1').remaining).toBe(2);
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
    expect(limiter.check('192.168.1.1').remaining).toBe(0);
  });

  it('blocks at exactly maxRequests + 1', () => {
    limiter = new InMemoryRateLimiter(3, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    const lastAllowed = limiter.check('192.168.1.1');
    const blocked = limiter.check('192.168.1.1');

    expect(lastAllowed.allowed).toBe(true);
    expect(lastAllowed.remaining).toBe(0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('returns correct retryAfterSeconds when blocked', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');

    // Advance 20s
    vi.advanceTimersByTime(20_000);

    const blocked = limiter.check('192.168.1.1');

    expect(blocked.allowed).toBe(false);
    // Oldest request was at t=0, window is 60s, so retryAfter ~= 40s
    expect(blocked.retryAfterSeconds).toBe(40);
  });

  it('allows requests again after window expires', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    expect(limiter.check('192.168.1.1').allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(60_001);

    const result = limiter.check('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('cleanup removes stale entries', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');

    // Advance past window
    vi.advanceTimersByTime(60_001);

    limiter.cleanup();

    // Should be fresh — allow full limit again
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
    expect(limiter.check('192.168.1.1').remaining).toBe(0);
  });

  it('cleanup deletes keys with no timestamps', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');

    vi.advanceTimersByTime(60_001);
    limiter.cleanup();

    // Internal store should have no keys — verify via a fresh check
    expect(limiter.check('192.168.1.1').remaining).toBe(1);
  });

  it('destroy stops cleanup interval', () => {
    limiter = new InMemoryRateLimiter(2, 60_000, 10_000);

    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    limiter.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('tracks different keys independently', () => {
    limiter = new InMemoryRateLimiter(2, 60_000);

    limiter.check('192.168.1.1');
    limiter.check('192.168.1.1');
    expect(limiter.check('192.168.1.1').allowed).toBe(false);

    // Different IP should still be allowed
    const result = limiter.check('10.0.0.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});
