import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryRateLimiter } from '../InMemoryRateLimiter';

describe('Login Rate Limiter (IP+phone based)', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    // 5 failed attempts per 15min (900_000ms) window, no cleanup timer in tests
    limiter = new InMemoryRateLimiter(5, 900_000, 999_999_999);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow first login attempt', () => {
    const result = limiter.check('login:192.168.1.1:+71234567890');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should allow up to 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('login:192.168.1.1:+71234567890');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('login:192.168.1.1:+71234567890');
    }

    const result = limiter.check('login:192.168.1.1:+71234567890');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should track different phone numbers independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('login:192.168.1.1:+71234567890');
    }

    // Different phone should still be allowed
    const result = limiter.check('login:192.168.1.1:+79876543210');
    expect(result.allowed).toBe(true);
  });

  it('should track same phone from different IPs independently', () => {
    // Exhaust limit from IP 1
    for (let i = 0; i < 5; i++) {
      limiter.check('login:192.168.1.1:+71234567890');
    }

    expect(limiter.check('login:192.168.1.1:+71234567890').allowed).toBe(false);

    // Same phone from different IP should still be allowed
    const result = limiter.check('login:10.0.0.1:+71234567890');
    expect(result.allowed).toBe(true);
  });

  it('should allow again after 15-min window expires', () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      limiter.check('login:192.168.1.1:+71234567890');
    }

    expect(limiter.check('login:192.168.1.1:+71234567890').allowed).toBe(false);

    // Advance past the 15-min window
    vi.advanceTimersByTime(901_000);

    expect(limiter.check('login:192.168.1.1:+71234567890').allowed).toBe(true);

    vi.useRealTimers();
  });

  it('should allow again after reset clears counter', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('login:192.168.1.1:+71234567890');
    }

    expect(limiter.check('login:192.168.1.1:+71234567890').allowed).toBe(false);

    limiter.reset('login:192.168.1.1:+71234567890');

    expect(limiter.check('login:192.168.1.1:+71234567890').allowed).toBe(true);
  });
});
