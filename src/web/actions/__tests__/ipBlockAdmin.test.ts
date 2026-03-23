import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIsSuperAdmin,
  mockPrisma,
  mockInvalidateCache,
  mockBlockIp,
  mockUnblockIp,
  mockGetBlockStatus,
  mockSearchBlockedIps,
  mockGetBlockHistory,
} = vi.hoisted(() => {
  const fn = vi.fn;

  return {
    mockIsSuperAdmin: fn(),
    mockPrisma: {
      ipBlockStatus: {
        findMany: fn().mockResolvedValue([]),
      },
    },
    mockInvalidateCache: fn(),
    mockBlockIp: fn().mockResolvedValue(undefined),
    mockUnblockIp: fn().mockResolvedValue(undefined),
    mockGetBlockStatus: fn().mockResolvedValue(null),
    mockSearchBlockedIps: fn().mockResolvedValue([]),
    mockGetBlockHistory: fn().mockResolvedValue([]),
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
  },
}));

vi.mock('@/infrastructure/repositories/IpBlockRepository', () => ({
  IpBlockRepository: class {
    blockIp = mockBlockIp;
    unblockIp = mockUnblockIp;
    getBlockStatus = mockGetBlockStatus;
    searchBlockedIps = mockSearchBlockedIps;
    getBlockHistory = mockGetBlockHistory;
  },
}));

vi.mock('@/infrastructure/rateLimit/ipBlockCheck', () => ({
  invalidateIpBlockCache: mockInvalidateCache,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

import { getCurrentUser } from '@/web/lib/session';

import {
  blockIpAction,
  unblockIpAction,
  getIpBlockStatusAction,
  getIpBlockHistoryAction,
  searchBlockedIpsAction,
  getBlockedIpsAction,
} from '../superadmin/ipBlockAdmin';

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

describe('ipBlockAdmin actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuperadmin();
  });

  describe('auth checks', () => {
    it('rejects non-superadmin for blockIp', async () => {
      setupNonSuperadmin();
      const result = await blockIpAction({
        ipAddress: '1.2.3.4',
        reason: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-superadmin for unblockIp', async () => {
      setupNonSuperadmin();
      const result = await unblockIpAction({
        ipAddress: '1.2.3.4',
        reason: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('blockIpAction', () => {
    it('creates blocked entry and invalidates cache', async () => {
      const result = await blockIpAction({
        ipAddress: '192.168.1.1',
        reason: 'brute force',
      });

      expect(result.success).toBe(true);
      expect(mockBlockIp).toHaveBeenCalledWith(
        '192.168.1.1',
        'admin-1',
        'brute force'
      );
      expect(mockInvalidateCache).toHaveBeenCalled();
    });

    it('rejects empty reason', async () => {
      const result = await blockIpAction({
        ipAddress: '192.168.1.1',
        reason: '',
      });
      expect(result.success).toBe(false);
      expect(mockBlockIp).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only reason', async () => {
      const result = await blockIpAction({
        ipAddress: '192.168.1.1',
        reason: '   ',
      });
      expect(result.success).toBe(false);
      expect(mockBlockIp).not.toHaveBeenCalled();
    });
  });

  describe('unblockIpAction', () => {
    it('creates unblocked entry and invalidates cache', async () => {
      const result = await unblockIpAction({
        ipAddress: '192.168.1.1',
        reason: 'false positive',
      });

      expect(result.success).toBe(true);
      expect(mockUnblockIp).toHaveBeenCalledWith(
        '192.168.1.1',
        'admin-1',
        'false positive'
      );
      expect(mockInvalidateCache).toHaveBeenCalled();
    });

    it('rejects empty reason', async () => {
      const result = await unblockIpAction({
        ipAddress: '192.168.1.1',
        reason: '',
      });
      expect(result.success).toBe(false);
      expect(mockUnblockIp).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only reason', async () => {
      const result = await unblockIpAction({
        ipAddress: '192.168.1.1',
        reason: '   ',
      });
      expect(result.success).toBe(false);
      expect(mockUnblockIp).not.toHaveBeenCalled();
    });
  });

  describe('getIpBlockStatusAction', () => {
    it('returns blocked status', async () => {
      mockGetBlockStatus.mockResolvedValue({
        blocked: true,
        reason: 'spam',
        blockedAt: new Date('2026-03-01'),
      });

      const result = await getIpBlockStatusAction({ ipAddress: '192.168.1.1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.blocked).toBe(true);
        expect(result.data.reason).toBe('spam');
      }
    });

    it('returns not blocked when no entries', async () => {
      mockGetBlockStatus.mockResolvedValue(null);

      const result = await getIpBlockStatusAction({ ipAddress: '192.168.1.1' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.blocked).toBe(false);
      }
    });
  });

  describe('getIpBlockHistoryAction', () => {
    it('returns history entries', async () => {
      const entries = [
        {
          id: '1',
          ipAddress: '192.168.1.1',
          status: 'blocked',
          reason: 'brute force',
          createdAt: new Date('2026-03-01'),
          statusChangedBy: { firstName: 'Admin', lastName: 'User' },
        },
      ];
      mockGetBlockHistory.mockResolvedValue(entries);

      const result = await getIpBlockHistoryAction({
        ipAddress: '192.168.1.1',
      });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('blocked');
      }
    });
  });

  describe('searchBlockedIpsAction', () => {
    it('returns error for query < 3 chars', async () => {
      const result = await searchBlockedIpsAction({ query: 'ab' });
      expect(result.success).toBe(false);
    });

    it('returns search results', async () => {
      const entries = [
        {
          ipAddress: '192.168.1.1',
          status: 'blocked',
          reason: 'spam',
          createdAt: new Date(),
          statusChangedBy: { id: 'a1', firstName: 'Admin', lastName: 'User' },
        },
      ];
      mockSearchBlockedIps.mockResolvedValue(entries);

      const result = await searchBlockedIpsAction({ query: '192.168' });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });
  });

  describe('getBlockedIpsAction', () => {
    it('returns paginated blocked IPs', async () => {
      const entries = [
        {
          ipAddress: '192.168.1.1',
          status: 'blocked',
          reason: 'spam',
          createdAt: new Date(),
          statusChangedBy: { id: 'a1', firstName: 'Admin', lastName: 'User' },
        },
      ];
      mockPrisma.ipBlockStatus.findMany.mockResolvedValue(entries);

      const result = await getBlockedIpsAction({});
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.items).toHaveLength(1);
      }
    });
  });
});
