import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsSuperAdmin, mockPrisma } = vi.hoisted(() => {
  const fn = vi.fn;

  return {
    mockIsSuperAdmin: fn(),
    mockPrisma: {
      rateLimitEvent: {
        groupBy: fn().mockResolvedValue([]),
        findMany: fn().mockResolvedValue([]),
        count: fn().mockResolvedValue(0),
      },
      userBlockStatus: {
        create: fn().mockResolvedValue({}),
        findFirst: fn().mockResolvedValue(null),
      },
      user: {
        findMany: fn().mockResolvedValue([]),
      },
    },
  };
});

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
  prisma: mockPrisma,
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: mockPrisma,
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
    searchUsers = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('@/infrastructure/rateLimit/registry', () => ({
  limiterRegistry: [],
  getLimiterByLabel: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

import { getCurrentUser } from '@/web/lib/session';

import {
  getSuspiciousActivitySummaryAction,
  blockUserAction,
  unblockUserAction,
  getUserBlockStatusAction,
  getUserBlockHistoryAction,
  searchUsersForAdminAction,
} from '../suspiciousActivity';

const mockUser = {
  id: 'admin-1',
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

describe('suspiciousActivity actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuperadmin();
  });

  describe('auth checks', () => {
    it('rejects non-superadmin for summary', async () => {
      setupNonSuperadmin();
      const result = await getSuspiciousActivitySummaryAction({});
      expect(result.success).toBe(false);
    });

    it('rejects non-superadmin for block', async () => {
      setupNonSuperadmin();
      const result = await blockUserAction({ userId: 'u1', reason: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('getSuspiciousActivitySummaryAction', () => {
    it('returns grouped events with counts', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([
        {
          key: 'user:abc',
          limiterLabel: 'phoneSearch',
          userId: 'abc',
          _count: { id: 5 },
          _min: { createdAt: new Date('2026-01-01') },
          _max: { createdAt: new Date('2026-03-07') },
        },
      ]);
      mockPrisma.rateLimitEvent.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'abc',
          firstName: 'Ivan',
          lastName: 'Petrov',
          phoneNumber: '+71234567890',
        },
      ]);
      mockPrisma.userBlockStatus.findFirst.mockResolvedValue(null);

      const result = await getSuspiciousActivitySummaryAction({ page: 1 });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.items).toHaveLength(1);
        expect(result.data.items[0].totalEvents).toBe(5);
        expect(result.data.items[0].key).toBe('user:abc');
      }
    });
  });

  describe('blockUserAction', () => {
    it('creates blocked entry', async () => {
      const result = await blockUserAction({ userId: 'u1', reason: 'spam' });
      expect(result.success).toBe(true);
      expect(mockPrisma.userBlockStatus.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          status: 'blocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'spam',
        },
      });
    });

    it('rejects empty reason', async () => {
      const result = await blockUserAction({ userId: 'u1', reason: '' });
      expect(result.success).toBe(false);
      expect(mockPrisma.userBlockStatus.create).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only reason', async () => {
      const result = await blockUserAction({ userId: 'u1', reason: '   ' });
      expect(result.success).toBe(false);
      expect(mockPrisma.userBlockStatus.create).not.toHaveBeenCalled();
    });
  });

  describe('unblockUserAction', () => {
    it('creates unblocked entry', async () => {
      const result = await unblockUserAction({
        userId: 'u1',
        reason: 'verified clean',
      });
      expect(result.success).toBe(true);
      expect(mockPrisma.userBlockStatus.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          status: 'unblocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'verified clean',
        },
      });
    });

    it('rejects empty reason', async () => {
      const result = await unblockUserAction({ userId: 'u1', reason: '' });
      expect(result.success).toBe(false);
      expect(mockPrisma.userBlockStatus.create).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only reason', async () => {
      const result = await unblockUserAction({ userId: 'u1', reason: '   ' });
      expect(result.success).toBe(false);
      expect(mockPrisma.userBlockStatus.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserBlockStatusAction', () => {
    it('returns blocked status', async () => {
      mockPrisma.userBlockStatus.findFirst.mockResolvedValue({
        status: 'blocked',
        reason: 'spam',
        createdAt: new Date('2026-03-01'),
      });

      const result = await getUserBlockStatusAction({ userId: 'u1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.blocked).toBe(true);
        expect(result.data.reason).toBe('spam');
      }
    });

    it('returns not blocked when no entries', async () => {
      mockPrisma.userBlockStatus.findFirst.mockResolvedValue(null);

      const result = await getUserBlockStatusAction({ userId: 'u1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.blocked).toBe(false);
      }
    });
  });

  describe('getUserBlockHistoryAction', () => {
    it('returns history entries for user', async () => {
      mockPrisma.userBlockStatus.findMany = vi.fn().mockResolvedValue([
        {
          id: 'h1',
          status: 'blocked',
          reason: 'spam',
          createdAt: new Date('2026-03-01'),
          statusChangedBy: { firstName: 'Admin', lastName: 'User' },
        },
        {
          id: 'h2',
          status: 'unblocked',
          reason: null,
          createdAt: new Date('2026-02-20'),
          statusChangedBy: { firstName: 'Admin', lastName: 'User' },
        },
      ]);

      const result = await getUserBlockHistoryAction({ userId: 'u1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].status).toBe('blocked');
        expect(result.data[1].status).toBe('unblocked');
      }
    });

    it('returns empty array when no history', async () => {
      mockPrisma.userBlockStatus.findMany = vi.fn().mockResolvedValue([]);

      const result = await getUserBlockHistoryAction({ userId: 'u1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  describe('searchUsersForAdminAction', () => {
    it('returns error for query < 3 chars', async () => {
      const result = await searchUsersForAdminAction({ query: 'ab' });
      expect(result.success).toBe(false);
    });

    it('returns users with block status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          firstName: 'Ivan',
          lastName: 'Petrov',
          middleName: null,
          phoneNumber: '+71234567890',
          nickname: 'ivan',
          createdAt: new Date(),
        },
      ]);
      mockPrisma.userBlockStatus.findFirst.mockResolvedValue(null);

      const result = await searchUsersForAdminAction({ query: 'Ivan' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('u1');
        expect(result.data[0].blockStatus).toBeNull();
      }
    });
  });
});
