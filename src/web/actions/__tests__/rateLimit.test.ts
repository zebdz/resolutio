import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetClientIp,
  mockGetSessionCookie,
  mockIsSuperadminIp,
  mockIsSuperadminSession,
  serverActionSessionLimiter,
  serverActionIpLimiter,
} = vi.hoisted(() => {
  // Must inline since vi.hoisted runs before imports
  class SimpleLimiter {
    private store: Map<string, number[]> = new Map();
    constructor(
      private readonly maxRequests: number,
      private readonly windowMs: number
    ) {}
    check(key: string) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const timestamps = this.store.get(key) ?? [];
      const recent = timestamps.filter((t) => t > windowStart);

      if (recent.length >= this.maxRequests) {
        this.store.set(key, recent);

        return { allowed: false, retryAfterSeconds: 1, remaining: 0 };
      }

      recent.push(now);
      this.store.set(key, recent);

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: this.maxRequests - recent.length,
      };
    }
    getEntries() {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const result: Array<{
        key: string;
        count: number;
        remaining: number;
        blocked: boolean;
      }> = [];

      for (const [key, timestamps] of this.store) {
        const recent = timestamps.filter((t) => t > windowStart);

        if (recent.length === 0) {
          continue;
        }

        result.push({
          key,
          count: recent.length,
          remaining: Math.max(this.maxRequests - recent.length, 0),
          blocked: recent.length >= this.maxRequests,
        });
      }

      return result;
    }
    clearAll() {
      this.store.clear();
    }
  }

  return {
    mockGetClientIp: vi.fn(),
    mockGetSessionCookie: vi.fn(),
    mockIsSuperadminIp: vi.fn(),
    mockIsSuperadminSession: vi.fn(),
    serverActionSessionLimiter: new SimpleLimiter(3, 60_000),
    serverActionIpLimiter: new SimpleLimiter(3, 60_000),
  };
});

vi.mock('@/web/lib/clientIp', () => ({
  getClientIp: mockGetClientIp,
}));

vi.mock('@/web/lib/session', () => ({
  getSessionCookie: mockGetSessionCookie,
}));

vi.mock('@/infrastructure/rateLimit/superadminWhitelist', () => ({
  isSuperadminIp: mockIsSuperadminIp,
  isSuperadminSession: mockIsSuperadminSession,
}));

vi.mock('@/infrastructure/rateLimit/superadminFallbackCheck', () => ({
  checkSuperadminBySessionFallback: () => Promise.resolve(false),
}));

vi.mock('@/infrastructure/rateLimit/registry', () => ({
  serverActionSessionLimiter,
  serverActionIpLimiter,
  phoneSearchLimiter: { check: vi.fn(), peek: vi.fn() },
  loginLimiter: { check: vi.fn(), peek: vi.fn(), reset: vi.fn() },
  registrationIpLimiter: { check: vi.fn() },
  registrationDeviceLimiter: { check: vi.fn() },
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

import { checkRateLimit } from '../rateLimit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    serverActionSessionLimiter.clearAll();
    serverActionIpLimiter.clearAll();
    mockIsSuperadminIp.mockReturnValue(false);
    mockIsSuperadminSession.mockReturnValue(false);
    mockGetClientIp.mockResolvedValue('127.0.0.1');
    mockGetSessionCookie.mockResolvedValue('session-123');
  });

  it('returns null when under limit', async () => {
    const result = await checkRateLimit();
    expect(result).toBeNull();
  });

  it('returns error when IP exceeds limit (unauthenticated)', async () => {
    mockGetSessionCookie.mockResolvedValue(null);
    serverActionIpLimiter.check('127.0.0.1');
    serverActionIpLimiter.check('127.0.0.1');
    serverActionIpLimiter.check('127.0.0.1');

    const result = await checkRateLimit();
    expect(result).toEqual({ success: false, error: 'tooManyRequests' });
  });

  it('returns error when session exceeds limit', async () => {
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');

    const result = await checkRateLimit();
    expect(result).toEqual({ success: false, error: 'tooManyRequests' });
  });

  it('authenticated requests do not record IP hits', async () => {
    await checkRateLimit();
    await checkRateLimit();

    const ipEntries = serverActionIpLimiter.getEntries();
    const ipEntry = ipEntries.find(
      (e: { key: string }) => e.key === '127.0.0.1'
    );
    expect(ipEntry).toBeUndefined();

    const sessionEntries = serverActionSessionLimiter.getEntries();
    const sessionEntry = sessionEntries.find(
      (e: { key: string }) => e.key === 'session:session-123'
    );
    expect(sessionEntry).toBeDefined();
    expect(sessionEntry!.count).toBe(2);
  });

  it('superadmin: records session hits but is never blocked', async () => {
    mockIsSuperadminSession.mockReturnValue(true);

    // Exhaust the session limiter
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');

    // Superadmin should NOT be blocked
    const result = await checkRateLimit();
    expect(result).toBeNull();

    // Session hits are still recorded
    const entries = serverActionSessionLimiter.getEntries();
    const sessionEntry = entries.find(
      (e: { key: string }) => e.key === 'session:session-123'
    );
    expect(sessionEntry).toBeDefined();
    expect(sessionEntry!.count).toBeGreaterThanOrEqual(3);
  });

  it('same-IP non-superadmin is still rate-limited', async () => {
    // Superadmin IP is whitelisted, but session is NOT superadmin
    mockIsSuperadminIp.mockReturnValue(true);
    mockIsSuperadminSession.mockReturnValue(false);

    // Exhaust the session limiter
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');
    serverActionSessionLimiter.check('session:session-123');

    // Non-superadmin session on superadmin IP should still be blocked
    const result = await checkRateLimit();
    expect(result).toEqual({ success: false, error: 'tooManyRequests' });
  });
});
