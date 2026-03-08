import { describe, it, expect, vi, beforeEach } from 'vitest';

import { IpBlockRepository } from '../IpBlockRepository';

import type { PrismaClient } from '@/generated/prisma/client';

const mockPrisma = {
  ipBlockStatus: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
} as unknown as PrismaClient;

describe('IpBlockRepository', () => {
  let repo: IpBlockRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new IpBlockRepository(mockPrisma);
  });

  describe('isIpBlocked', () => {
    it('returns true when latest entry has status "blocked"', async () => {
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue({
        status: 'blocked',
      });

      expect(await repo.isIpBlocked('192.168.1.1')).toBe(true);
      expect((mockPrisma as any).ipBlockStatus.findFirst).toHaveBeenCalledWith({
        where: { ipAddress: '192.168.1.1' },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
    });

    it('returns false when latest entry has status "unblocked"', async () => {
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue({
        status: 'unblocked',
      });

      expect(await repo.isIpBlocked('192.168.1.1')).toBe(false);
    });

    it('returns false when no entries exist', async () => {
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue(null);

      expect(await repo.isIpBlocked('192.168.1.1')).toBe(false);
    });
  });

  describe('blockIp', () => {
    it('creates entry with status "blocked"', async () => {
      (mockPrisma as any).ipBlockStatus.create.mockResolvedValue({});

      await repo.blockIp('192.168.1.1', 'admin-1', 'brute force');

      expect((mockPrisma as any).ipBlockStatus.create).toHaveBeenCalledWith({
        data: {
          ipAddress: '192.168.1.1',
          status: 'blocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'brute force',
        },
      });
    });
  });

  describe('unblockIp', () => {
    it('creates entry with status "unblocked"', async () => {
      (mockPrisma as any).ipBlockStatus.create.mockResolvedValue({});

      await repo.unblockIp('192.168.1.1', 'admin-1', 'false positive');

      expect((mockPrisma as any).ipBlockStatus.create).toHaveBeenCalledWith({
        data: {
          ipAddress: '192.168.1.1',
          status: 'unblocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'false positive',
        },
      });
    });
  });

  describe('getBlockStatus', () => {
    it('returns blocked status with reason and date', async () => {
      const blockedAt = new Date('2026-03-01');
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue({
        status: 'blocked',
        reason: 'suspicious',
        createdAt: blockedAt,
      });

      const result = await repo.getBlockStatus('192.168.1.1');

      expect(result).toEqual({
        blocked: true,
        reason: 'suspicious',
        blockedAt,
      });
    });

    it('returns unblocked status', async () => {
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue({
        status: 'unblocked',
        reason: null,
        createdAt: new Date(),
      });

      const result = await repo.getBlockStatus('192.168.1.1');
      expect(result).toEqual({ blocked: false });
    });

    it('returns null when no entries exist', async () => {
      (mockPrisma as any).ipBlockStatus.findFirst.mockResolvedValue(null);

      expect(await repo.getBlockStatus('192.168.1.1')).toBeNull();
    });
  });

  describe('searchBlockedIps', () => {
    it('returns matching entries with superadmin info', async () => {
      const entries = [
        {
          ipAddress: '192.168.1.1',
          status: 'blocked',
          reason: 'brute force',
          createdAt: new Date('2026-03-01'),
          statusChangedBy: {
            id: 'admin-1',
            firstName: 'Admin',
            lastName: 'User',
          },
        },
      ];
      (mockPrisma as any).ipBlockStatus.findMany.mockResolvedValue(entries);

      const result = await repo.searchBlockedIps('192.168');

      expect(result).toEqual(entries);
      expect((mockPrisma as any).ipBlockStatus.findMany).toHaveBeenCalledWith({
        where: { ipAddress: { contains: '192.168' } },
        orderBy: { createdAt: 'desc' },
        distinct: ['ipAddress'],
        select: {
          ipAddress: true,
          status: true,
          reason: true,
          createdAt: true,
          statusChangedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    });
  });

  describe('getAllBlockedIps', () => {
    it('returns distinct IPs where latest status is blocked', async () => {
      // getAllBlockedIps gets all distinct IPs with latest status
      (mockPrisma as any).ipBlockStatus.findMany.mockResolvedValue([
        { ipAddress: '192.168.1.1', status: 'blocked' },
        { ipAddress: '10.0.0.1', status: 'blocked' },
        { ipAddress: '172.16.0.1', status: 'unblocked' },
      ]);

      const result = await repo.getAllBlockedIps();

      expect(result).toEqual(['192.168.1.1', '10.0.0.1']);
    });
  });

  describe('getBlockHistory', () => {
    it('returns all entries for an IP ordered by date desc', async () => {
      const entries = [
        {
          id: '1',
          ipAddress: '192.168.1.1',
          status: 'blocked',
          reason: 'brute force',
          createdAt: new Date('2026-03-01'),
          statusChangedBy: { firstName: 'Admin', lastName: 'User' },
        },
        {
          id: '2',
          ipAddress: '192.168.1.1',
          status: 'unblocked',
          reason: null,
          createdAt: new Date('2026-02-20'),
          statusChangedBy: { firstName: 'Admin', lastName: 'User' },
        },
      ];
      (mockPrisma as any).ipBlockStatus.findMany.mockResolvedValue(entries);

      const result = await repo.getBlockHistory('192.168.1.1');

      expect(result).toEqual(entries);
      expect((mockPrisma as any).ipBlockStatus.findMany).toHaveBeenCalledWith({
        where: { ipAddress: '192.168.1.1' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ipAddress: true,
          status: true,
          reason: true,
          createdAt: true,
          statusChangedBy: {
            select: { firstName: true, lastName: true },
          },
        },
      });
    });
  });
});
