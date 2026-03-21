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
        findMany: fn().mockResolvedValue([]),
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

  describe('getSuspiciousActivitySummaryAction filters', () => {
    beforeEach(() => {
      mockPrisma.rateLimitEvent.count.mockResolvedValue(0);
      mockPrisma.userBlockStatus.findFirst.mockResolvedValue(null);
      // Reset user.findMany to avoid mockResolvedValueOnce leaking between tests
      mockPrisma.user.findMany.mockReset().mockResolvedValue([]);
    });

    it('passes search filter — matches user fields and key', async () => {
      mockPrisma.user.findMany
        // First call: search users by name/phone/nickname
        .mockResolvedValueOnce([{ id: 'u1' }])
        // Second call: resolve user details
        .mockResolvedValueOnce([
          {
            id: 'u1',
            firstName: 'Ivan',
            lastName: 'Petrov',
            phoneNumber: '+71234567890',
          },
        ]);
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([
        {
          key: 'user:u1',
          limiterLabel: 'phoneSearch',
          userId: 'u1',
          _count: { id: 3 },
          _min: { createdAt: new Date('2026-01-01') },
          _max: { createdAt: new Date('2026-03-01') },
        },
      ]);

      const result = await getSuspiciousActivitySummaryAction({
        page: 1,
        search: 'Ivan',
      });

      expect(result.success).toBe(true);
      // Verify user search was called
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { firstName: { contains: 'Ivan', mode: 'insensitive' } },
              { lastName: { contains: 'Ivan', mode: 'insensitive' } },
              { nickname: { contains: 'Ivan', mode: 'insensitive' } },
              { phoneNumber: { contains: 'Ivan', mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        })
      );
      // Verify groupBy was called with OR filter (userId IN + key ILIKE)
      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { userId: { in: ['u1'] } },
                  { key: { contains: 'Ivan', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('passes search filter — no matching users, still searches key', async () => {
      mockPrisma.user.findMany
        .mockResolvedValueOnce([]) // no users found
        .mockResolvedValueOnce([]); // resolve users (empty)
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        search: '192.168.1.1',
      });

      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { key: { contains: '192.168.1.1', mode: 'insensitive' } },
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('passes dateFrom filter on createdAt', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        dateFrom: '2026-02-01',
      });

      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { createdAt: { gte: new Date('2026-02-01') } },
            ]),
          }),
        })
      );
    });

    it('passes dateTo filter on createdAt', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        dateTo: '2026-03-01',
      });

      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { createdAt: { lte: new Date('2026-03-01T23:59:59.999Z') } },
            ]),
          }),
        })
      );
    });

    it('passes minBlocked as having filter', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        minBlocked: 3,
      });

      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          having: expect.objectContaining({
            id: expect.objectContaining({
              _count: expect.objectContaining({ gte: 3 }),
            }),
          }),
        })
      );
    });

    it('passes maxBlocked as having filter', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        maxBlocked: 10,
      });

      expect(mockPrisma.rateLimitEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          having: expect.objectContaining({
            id: expect.objectContaining({
              _count: expect.objectContaining({ lte: 10 }),
            }),
          }),
        })
      );
    });

    it('combines multiple filters', async () => {
      mockPrisma.user.findMany
        .mockResolvedValueOnce([{ id: 'u2' }])
        .mockResolvedValueOnce([]);
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        search: 'test',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-01',
        minBlocked: 2,
        maxBlocked: 20,
      });

      const call = mockPrisma.rateLimitEvent.groupBy.mock.calls[0][0];
      expect(call.where.AND).toHaveLength(3); // search OR + dateFrom + dateTo
      expect(call.having.id._count).toEqual({ gte: 2, lte: 20 });
    });

    it('applies same where clause to count query', async () => {
      mockPrisma.rateLimitEvent.groupBy.mockResolvedValue([]);

      await getSuspiciousActivitySummaryAction({
        page: 1,
        dateFrom: '2026-02-01',
      });

      expect(mockPrisma.rateLimitEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { createdAt: { gte: new Date('2026-02-01') } },
            ]),
          }),
        })
      );
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
