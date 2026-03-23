import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsSuperAdmin } = vi.hoisted(() => ({
  mockIsSuperAdmin: vi.fn(),
}));

// Mock dependencies before imports
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
  prisma: {
    rateLimitEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    session: { findMany: vi.fn().mockResolvedValue([]) },
    superAdmin: { findUnique: vi.fn() },
    userBlockStatus: { findFirst: vi.fn() },
  },
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
    { label: 'login', limiter: login, maxRequests: 5, windowMs: 15 * 60_000 },
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
    middlewareSessionLimiter: middlewareSession,
    middlewareIpLimiter: middlewareIp,
    serverActionSessionLimiter: serverActionSession,
    serverActionIpLimiter: serverActionIp,
    phoneSearchLimiter: phoneSearch,
    loginLimiter: login,
    registrationIpLimiter: regIp,
    registrationDeviceLimiter: regDevice,
  };
});

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

import { getCurrentUser } from '@/web/lib/session';
import {
  limiterRegistry,
  getLimiterByLabel,
} from '@/infrastructure/rateLimit/registry';
import { prisma } from '@/infrastructure/index';

import {
  getRateLimitOverviewAction,
  resetAllRateLimitsAction,
  resetLimiterAction,
  clearBlockedKeysAction,
  searchRateLimitEntriesAction,
  resetRateLimitKeysAction,
  lockRateLimitKeyAction,
  unlockRateLimitKeyAction,
} from '../superadmin/rateLimitAdmin';

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

function setupNonSuperadmin() {
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  mockIsSuperAdmin.mockResolvedValue(false);
}

function setupUnauthenticated() {
  (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
}

describe('rateLimitAdmin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear all limiters between tests
    for (const entry of limiterRegistry) {
      entry.limiter.clearAll();
    }

    setupSuperadmin();
  });

  describe('auth checks', () => {
    it('rejects unauthenticated users', async () => {
      setupUnauthenticated();
      const result = await getRateLimitOverviewAction();
      expect(result.success).toBe(false);
    });

    it('rejects non-superadmin', async () => {
      setupNonSuperadmin();
      const result = await getRateLimitOverviewAction();
      expect(result.success).toBe(false);
    });
  });

  describe('getRateLimitOverviewAction', () => {
    it('returns 8 limiters with counts', async () => {
      const middlewareIp = getLimiterByLabel('middlewareIp')!;
      middlewareIp.limiter.check('1.2.3.4');
      middlewareIp.limiter.check('5.6.7.8');

      const result = await getRateLimitOverviewAction();
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(8);
        const mw = result.data.find((e) => e.label === 'middlewareIp');
        expect(mw).toBeDefined();
        expect(mw!.entryCount).toBe(2);
        expect(mw!.blockedCount).toBe(0);
      }
    });
  });

  describe('resetAllRateLimitsAction', () => {
    it('clears all limiters', async () => {
      getLimiterByLabel('middlewareSession')!.limiter.check('1.2.3.4');
      getLimiterByLabel('login')!.limiter.check('login:1.2.3.4:+7123');

      const result = await resetAllRateLimitsAction();
      expect(result.success).toBe(true);

      for (const entry of limiterRegistry) {
        expect(entry.limiter.size).toBe(0);
      }
    });
  });

  describe('resetLimiterAction', () => {
    it('clears entries for specified limiter', async () => {
      getLimiterByLabel('middlewareSession')!.limiter.check('1.2.3.4');
      getLimiterByLabel('login')!.limiter.check('login:x');

      const result = await resetLimiterAction({ label: 'middlewareSession' });
      expect(result.success).toBe(true);
      expect(getLimiterByLabel('middlewareSession')!.limiter.size).toBe(0);
      expect(getLimiterByLabel('login')!.limiter.size).toBe(1);
    });

    it('returns error for invalid label', async () => {
      const result = await resetLimiterAction({ label: 'nonexistent' });
      expect(result.success).toBe(false);
    });
  });

  describe('clearBlockedKeysAction', () => {
    it('resets only blocked keys', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;

      for (let i = 0; i < 60; i++) {
        mw.limiter.check('blocked-ip');
      }

      mw.limiter.check('ok-ip');

      const result = await clearBlockedKeysAction({
        label: 'middlewareSession',
      });
      expect(result.success).toBe(true);
      expect(mw.limiter.getBlockedKeys()).toHaveLength(0);
      expect(mw.limiter.size).toBe(1);
    });
  });

  describe('searchRateLimitEntriesAction', () => {
    it('returns matching entries', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;
      mw.limiter.check('192.168.1.1');
      mw.limiter.check('10.0.0.1');

      const result = await searchRateLimitEntriesAction({
        label: 'middlewareSession',
        query: '192',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].key).toBe('192.168.1.1');
      }
    });

    it('returns error for query < 3 chars', async () => {
      const result = await searchRateLimitEntriesAction({
        label: 'middlewareSession',
        query: 'ab',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('resetRateLimitKeysAction', () => {
    it('resets specified keys', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;
      mw.limiter.check('a');
      mw.limiter.check('b');
      mw.limiter.check('c');

      const result = await resetRateLimitKeysAction({
        label: 'middlewareSession',
        keys: ['a', 'b'],
      });
      expect(result.success).toBe(true);
      expect(mw.limiter.size).toBe(1);
    });
  });

  describe('lockRateLimitKeyAction', () => {
    it('locks specified key', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;

      const result = await lockRateLimitKeyAction({
        label: 'middlewareSession',
        key: '1.2.3.4',
      });
      expect(result.success).toBe(true);
      expect(mw.limiter.peek('1.2.3.4').allowed).toBe(false);
    });

    it('returns error for invalid label', async () => {
      const result = await lockRateLimitKeyAction({
        label: 'invalid',
        key: 'x',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('unlockRateLimitKeyAction', () => {
    it('unlocks a blocked key', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;
      mw.limiter.lockKey('1.2.3.4');
      expect(mw.limiter.peek('1.2.3.4').allowed).toBe(false);

      const result = await unlockRateLimitKeyAction({
        label: 'middlewareSession',
        key: '1.2.3.4',
      });
      expect(result.success).toBe(true);
      expect(mw.limiter.peek('1.2.3.4').allowed).toBe(true);
    });

    it('returns error for invalid label', async () => {
      const result = await unlockRateLimitKeyAction({
        label: 'invalid',
        key: 'x',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('session-keyed search', () => {
    it('finds middleware entries by phone via session lookup', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;
      mw.limiter.check('mw-session:sess-abc');

      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'user-42',
          firstName: 'Ivan',
          lastName: 'Petrov',
          phoneNumber: '+79001234567',
        },
      ]);
      (prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sess-abc' },
      ]);

      const result = await searchRateLimitEntriesAction({
        label: 'middlewareSession',
        query: '+7900',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].key).toBe('mw-session:sess-abc');
      }
    });

    it('finds serverAction entries by phone via session lookup', async () => {
      const sa = getLimiterByLabel('serverActionSession')!;
      sa.limiter.check('session:sess-xyz');

      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'user-42',
          firstName: 'Ivan',
          lastName: 'Petrov',
          phoneNumber: '+79001234567',
        },
      ]);
      (prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sess-xyz' },
      ]);

      const result = await searchRateLimitEntriesAction({
        label: 'serverActionSession',
        query: '+7900',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.length).toBe(1);
        expect(result.data[0].key).toBe('session:sess-xyz');
      }
    });

    it('enriches session-keyed entries with resolvedUser', async () => {
      const mw = getLimiterByLabel('middlewareSession')!;
      mw.limiter.check('mw-session:sess-enrich');

      // First call: searchUsersByQuery for session lookup
      // Second call: enrichment user lookup
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'user-99',
          firstName: 'Anna',
          lastName: 'Smirnova',
          phoneNumber: '+79009999999',
        },
      ]);
      (prisma.session.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sess-enrich', userId: 'user-99' },
      ]);

      const result = await searchRateLimitEntriesAction({
        label: 'middlewareSession',
        query: '+7900',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data[0].resolvedUser).toBeDefined();
        expect(result.data[0].resolvedUser!.firstName).toBe('Anna');
        expect(result.data[0].resolvedUser!.phoneNumber).toBe('+79009999999');
      }
    });
  });
});
