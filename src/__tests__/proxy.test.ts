import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-intl/middleware before importing proxy
vi.mock('next-intl/middleware', () => ({
  default: () => {
    return async () => {
      const { NextResponse } = await import('next/server');

      return NextResponse.next();
    };
  },
}));

vi.mock('../i18n/routing', () => ({
  routing: { locales: ['en', 'ru'], defaultLocale: 'ru' },
}));

vi.mock('../infrastructure/rateLimit/ipBlockCheck', () => ({
  isIpBlocked: () => false,
}));

vi.mock('../infrastructure/rateLimit/superadminWhitelist', () => ({
  isSuperadminIp: () => false,
  isSuperadminSession: () => false,
}));

// Use real limiter for testing — vi.hoisted ensures it's available in vi.mock factory
const { testLimiter } = vi.hoisted(() => {
  // Inline the limiter logic to avoid import hoisting issues
  class SimpleLimiter {
    private store: Map<string, number[]> = new Map();
    constructor(
      private maxRequests: number,
      private windowMs: number
    ) {}
    check(key: string) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const timestamps = this.store.get(key) ?? [];
      const recent = timestamps.filter((t: number) => t > windowStart);

      if (recent.length >= this.maxRequests) {
        const oldestInWindow = recent[0];
        const retryAfterMs = oldestInWindow + this.windowMs - now;
        this.store.set(key, recent);

        return {
          allowed: false,
          retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
          remaining: 0,
        };
      }

      recent.push(now);
      this.store.set(key, recent);

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: this.maxRequests - recent.length,
      };
    }
    peek(key: string) {
      const now = Date.now();
      const windowStart = now - this.windowMs;
      const timestamps = this.store.get(key) ?? [];
      const recent = timestamps.filter((t: number) => t > windowStart);

      if (recent.length >= this.maxRequests) {
        return { allowed: false, retryAfterSeconds: 1, remaining: 0 };
      }

      return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: this.maxRequests - recent.length,
      };
    }
    clearAll() {
      this.store.clear();
    }
  }

  return { testLimiter: new SimpleLimiter(3, 60_000) };
});

vi.mock('../infrastructure/rateLimit', () => ({
  middlewareLimiter: testLimiter,
  getLimiterByLabel: () => ({ maxRequests: 3 }),
}));

import middleware from '../proxy';

function makeRequest(
  path: string,
  options?: { sessionCookie?: string; accept?: string; ip?: string }
) {
  const url = `http://localhost:3000${path}`;
  const headers: Record<string, string> = {
    accept: options?.accept ?? 'text/html',
    'x-forwarded-for': options?.ip ?? '1.2.3.4',
  };
  const req = new NextRequest(url, { headers });

  if (options?.sessionCookie) {
    // NextRequest cookies can be set via cookie header
    req.cookies.set('session', options.sessionCookie);
  }

  return req;
}

describe('proxy middleware dual-key rate limiting', () => {
  beforeEach(() => {
    testLimiter.clearAll();
  });

  afterEach(() => {
    testLimiter.clearAll();
  });

  it('unauthenticated: blocks when IP exceeds limit', () => {
    // Exhaust 3 requests (our test limiter limit)
    for (let i = 0; i < 3; i++) {
      const res = middleware(makeRequest('/en/dashboard'));
      expect(res.status).not.toBe(302);
    }

    // 4th request should be blocked
    const res = middleware(makeRequest('/en/dashboard'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/rate-limited');
  });

  it('authenticated: blocks based on session, not IP', () => {
    // Exhaust IP budget (3 requests from same IP but different sessions)
    for (let i = 0; i < 3; i++) {
      middleware(
        makeRequest('/en/dashboard', { sessionCookie: `session-${i}` })
      );
    }

    // IP is exhausted, but a new session should still be allowed
    const res = middleware(
      makeRequest('/en/dashboard', { sessionCookie: 'session-new' })
    );
    expect(res.status).not.toBe(302);
  });

  it('authenticated: blocks when session exceeds limit', () => {
    // Exhaust session budget
    for (let i = 0; i < 3; i++) {
      const res = middleware(
        makeRequest('/en/dashboard', { sessionCookie: 'same-session' })
      );
      expect(res.status).not.toBe(302);
    }

    // 4th request with same session should be blocked
    const res = middleware(
      makeRequest('/en/dashboard', { sessionCookie: 'same-session' })
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/rate-limited');
  });

  it('two authenticated users behind same IP get independent budgets', () => {
    // User A makes 3 requests (exhausts their budget)
    for (let i = 0; i < 3; i++) {
      middleware(makeRequest('/en/dashboard', { sessionCookie: 'user-a' }));
    }

    // User A is blocked
    const resA = middleware(
      makeRequest('/en/dashboard', { sessionCookie: 'user-a' })
    );
    expect(resA.status).toBe(302);

    // User B (same IP) should NOT be blocked
    const resB = middleware(
      makeRequest('/en/dashboard', { sessionCookie: 'user-b' })
    );
    expect(resB.status).not.toBe(302);
  });

  it('authenticated requests do not record IP hits', () => {
    // Make authenticated requests
    for (let i = 0; i < 2; i++) {
      middleware(
        makeRequest('/en/dashboard', { sessionCookie: 'some-session' })
      );
    }

    // IP key should have NO recorded hits
    const ipResult = testLimiter.peek('1.2.3.4');
    expect(ipResult.remaining).toBe(3);
  });

  it('API route returns 429 JSON when session-blocked', () => {
    // Exhaust session budget
    for (let i = 0; i < 3; i++) {
      middleware(
        makeRequest('/api/something', {
          sessionCookie: 'api-session',
          accept: 'application/json',
        })
      );
    }

    // 4th request
    const res = middleware(
      makeRequest('/api/something', {
        sessionCookie: 'api-session',
        accept: 'application/json',
      })
    );
    expect(res.status).toBe(429);
  });
});
