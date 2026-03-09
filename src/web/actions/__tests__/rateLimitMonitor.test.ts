import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsSuperAdmin } = vi.hoisted(() => ({
  mockIsSuperAdmin: vi.fn(),
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: vi.fn(),
  getSessionCookie: vi.fn().mockResolvedValue('mock-session'),
}));

vi.mock('@/web/lib/clientIp', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('@/infrastructure/rateLimit/superadminWhitelist', () => ({
  registerSuperadminAccess: vi.fn(),
  isSuperadminIp: vi.fn().mockReturnValue(false),
}));

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: {},
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
}));

vi.mock('@/infrastructure/rateLimit/registry', async () => {
  const { InMemoryRateLimiter } =
    await import('@/infrastructure/rateLimit/InMemoryRateLimiter');
  const middlewareSession = new InMemoryRateLimiter(60, 60_000);
  const middlewareIp = new InMemoryRateLimiter(50_000, 60_000);
  const serverActionSession = new InMemoryRateLimiter(200, 60_000);
  const serverActionIp = new InMemoryRateLimiter(200_000, 60_000);
  const phoneSearch = new InMemoryRateLimiter(5, 30 * 60_000);
  const login = new InMemoryRateLimiter(5, 15 * 60_000);
  const regIp = new InMemoryRateLimiter(5_000, 60 * 60_000);
  const regDevice = new InMemoryRateLimiter(3, 60 * 60_000);

  const registry = [
    {
      label: 'middlewareSession',
      limiter: middlewareSession,
      maxRequests: 60,
      windowMs: 60_000,
    },
    {
      label: 'middlewareIp',
      limiter: middlewareIp,
      maxRequests: 50_000,
      windowMs: 60_000,
    },
    {
      label: 'serverActionSession',
      limiter: serverActionSession,
      maxRequests: 200,
      windowMs: 60_000,
    },
    {
      label: 'serverActionIp',
      limiter: serverActionIp,
      maxRequests: 200_000,
      windowMs: 60_000,
    },
    {
      label: 'phoneSearch',
      limiter: phoneSearch,
      maxRequests: 5,
      windowMs: 30 * 60_000,
    },
    {
      label: 'login',
      limiter: login,
      maxRequests: 5,
      windowMs: 15 * 60_000,
    },
    {
      label: 'registrationIp',
      limiter: regIp,
      maxRequests: 5_000,
      windowMs: 60 * 60_000,
    },
    {
      label: 'registrationDevice',
      limiter: regDevice,
      maxRequests: 3,
      windowMs: 60 * 60_000,
    },
  ];

  return {
    limiterRegistry: registry,
    getLimiterByLabel: (label: string) =>
      registry.find((e) => e.label === label),
  };
});

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

import { getCurrentUser } from '@/web/lib/session';
import { limiterRegistry } from '@/infrastructure/rateLimit/registry';
import {
  getRateLimitMonitorSnapshotAction,
  getKeyLimiterDetailsAction,
} from '../rateLimitMonitor';

const mockUser = {
  id: 'user-1',
  firstName: 'Admin',
  lastName: 'User',
  phoneNumber: { getValue: () => '+71234567890' },
  nickname: { getValue: () => 'admin' },
  privacySetupCompleted: true,
};

function setupSuperadmin() {
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  mockIsSuperAdmin.mockResolvedValue(true);
}

function setupUnauthenticated() {
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

describe('rateLimitMonitor actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    for (const entry of limiterRegistry) {
      entry.limiter.clearAll();
    }

    setupSuperadmin();
  });

  describe('getRateLimitMonitorSnapshotAction', () => {
    it('rejects unauthenticated users', async () => {
      setupUnauthenticated();
      const result = await getRateLimitMonitorSnapshotAction();
      expect(result.success).toBe(false);
    });

    it('returns empty when no entries', async () => {
      const result = await getRateLimitMonitorSnapshotAction();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns entries sorted by count desc', async () => {
      const mw = limiterRegistry[0].limiter;
      // 3 hits on IP-A
      mw.check('192.168.1.1');
      mw.check('192.168.1.1');
      mw.check('192.168.1.1');
      // 1 hit on IP-B
      mw.check('192.168.1.2');

      const result = await getRateLimitMonitorSnapshotAction();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(2);
        expect(result.data[0].key).toBe('192.168.1.1');
        expect(result.data[0].count).toBe(3);
        expect(result.data[1].key).toBe('192.168.1.2');
        expect(result.data[1].count).toBe(1);
      }
    });

    it('filters by query substring (3+ chars)', async () => {
      const mw = limiterRegistry[0].limiter;
      mw.check('192.168.1.1');
      mw.check('10.0.0.1');

      const result = await getRateLimitMonitorSnapshotAction({
        query: '192',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].key).toBe('192.168.1.1');
      }
    });

    it('ignores query shorter than 3 chars', async () => {
      const mw = limiterRegistry[0].limiter;
      mw.check('192.168.1.1');
      mw.check('10.0.0.1');

      const result = await getRateLimitMonitorSnapshotAction({ query: '19' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(2);
      }
    });

    it('filters by limiter label', async () => {
      limiterRegistry[0].limiter.check('192.168.1.1'); // middleware
      limiterRegistry[1].limiter.check('192.168.1.1'); // serverAction

      const result = await getRateLimitMonitorSnapshotAction({
        label: 'middlewareSession',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].limiterLabel).toBe('middlewareSession');
      }
    });

    it('limits results to 100', async () => {
      const mw = limiterRegistry[0].limiter;

      for (let i = 0; i < 110; i++) {
        mw.check(`ip-${i}`);
      }

      const result = await getRateLimitMonitorSnapshotAction();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(100);
      }
    });
  });

  describe('getKeyLimiterDetailsAction', () => {
    it('returns only limiters with activity for the key', async () => {
      limiterRegistry[0].limiter.check('192.168.1.1');

      const result = await getKeyLimiterDetailsAction({
        key: '192.168.1.1',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        // Only middleware has activity — zero-count limiters are excluded
        expect(result.data.length).toBe(1);
        expect(result.data[0].limiterLabel).toBe('middlewareSession');
        expect(result.data[0].count).toBe(1);
        expect(result.data[0].maxRequests).toBe(60);
      }
    });

    it('shows blocked status correctly', async () => {
      const mw = limiterRegistry[0].limiter;

      // Fill up middleware limiter
      for (let i = 0; i < 60; i++) {
        mw.check('blocked-ip');
      }

      const result = await getKeyLimiterDetailsAction({ key: 'blocked-ip' });
      expect(result.success).toBe(true);

      if (result.success) {
        // Only middleware should be returned (has activity)
        expect(result.data.length).toBe(1);
        expect(result.data[0].limiterLabel).toBe('middlewareSession');
        expect(result.data[0].blocked).toBe(true);
        expect(result.data[0].remaining).toBe(0);
      }
    });

    it('returns empty array for key with no activity', async () => {
      const result = await getKeyLimiterDetailsAction({
        key: 'unknown-key',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });
});
