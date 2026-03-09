import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryRateLimiter } from '../InMemoryRateLimiter';

describe('Registration Rate Limiter — IP (sliding window behavior)', () => {
  const TEST_LIMIT = 50;
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(TEST_LIMIT, 3_600_000, 999_999_999);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow first attempt', () => {
    const result = limiter.check('register:192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(TEST_LIMIT - 1);
  });

  it('should allow up to limit', () => {
    for (let i = 0; i < TEST_LIMIT; i++) {
      const result = limiter.check('register:192.168.1.1');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block at limit + 1', () => {
    for (let i = 0; i < TEST_LIMIT; i++) {
      limiter.check('register:192.168.1.1');
    }

    const result = limiter.check('register:192.168.1.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should track different IPs independently', () => {
    for (let i = 0; i < TEST_LIMIT; i++) {
      limiter.check('register:192.168.1.1');
    }

    const result = limiter.check('register:10.0.0.1');
    expect(result.allowed).toBe(true);
  });

  it('should allow after window expires', () => {
    vi.useFakeTimers();

    for (let i = 0; i < TEST_LIMIT; i++) {
      limiter.check('register:192.168.1.1');
    }

    expect(limiter.check('register:192.168.1.1').allowed).toBe(false);

    vi.advanceTimersByTime(3_601_000);

    expect(limiter.check('register:192.168.1.1').allowed).toBe(true);

    vi.useRealTimers();
  });
});

describe('Registration Rate Limiter — Device (3/hr)', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter(3, 3_600_000, 999_999_999);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow first attempt', () => {
    const result = limiter.check('register:device-uuid-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should allow up to 3 attempts', () => {
    for (let i = 0; i < 3; i++) {
      const result = limiter.check('register:device-uuid-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block 4th attempt', () => {
    for (let i = 0; i < 3; i++) {
      limiter.check('register:device-uuid-1');
    }

    const result = limiter.check('register:device-uuid-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should track different device IDs independently', () => {
    for (let i = 0; i < 3; i++) {
      limiter.check('register:device-uuid-1');
    }

    const result = limiter.check('register:device-uuid-2');
    expect(result.allowed).toBe(true);
  });

  it('should allow after window expires', () => {
    vi.useFakeTimers();

    for (let i = 0; i < 3; i++) {
      limiter.check('register:device-uuid-1');
    }

    expect(limiter.check('register:device-uuid-1').allowed).toBe(false);

    vi.advanceTimersByTime(3_601_000);

    expect(limiter.check('register:device-uuid-1').allowed).toBe(true);

    vi.useRealTimers();
  });
});
