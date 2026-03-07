import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryRateLimiter } from '../InMemoryRateLimiter';

describe('Phone Search Rate Limiter (userId-based)', () => {
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    // 5 failed attempts per 60s window, no cleanup timer in tests
    limiter = new InMemoryRateLimiter(5, 60_000, 999_999_999);
  });

  afterEach(() => {
    limiter.destroy();
  });

  it('should allow first phone search attempt', () => {
    const result = limiter.check('user-abc-123');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should allow up to 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user-abc-123');
      expect(result.allowed).toBe(true);
    }
  });

  it('should block after 5 failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-abc-123');
    }

    const result = limiter.check('user-abc-123');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should track different userIds independently', () => {
    for (let i = 0; i < 5; i++) {
      limiter.check('user-abc-123');
    }

    // Different userId should still be allowed
    const result = limiter.check('user-def-456');
    expect(result.allowed).toBe(true);
  });

  it('should allow again after window expires', () => {
    vi.useFakeTimers();

    for (let i = 0; i < 5; i++) {
      limiter.check('user-abc-123');
    }

    expect(limiter.check('user-abc-123').allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(61_000);

    expect(limiter.check('user-abc-123').allowed).toBe(true);

    vi.useRealTimers();
  });
});
