import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PrismaUserRepository } from '../PrismaUserRepository';

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
  superAdmin: { findUnique: vi.fn() },
  userBlockStatus: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  userPrivacyAuditLog: { create: vi.fn() },
  $transaction: vi.fn(),
} as unknown as Parameters<
  typeof PrismaUserRepository extends new (p: infer P) => unknown
    ? never
    : never
>[0];

// We need the actual type
import type { PrismaClient } from '@/generated/prisma/client';

describe('UserBlockStatus methods', () => {
  let repo: PrismaUserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaUserRepository(mockPrisma as unknown as PrismaClient);
  });

  describe('isUserBlocked', () => {
    it('returns true when latest entry has status "blocked"', async () => {
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue({
        id: '1',
        status: 'blocked',
        reason: 'spam',
        createdAt: new Date(),
      });

      expect(await repo.isUserBlocked('user-1')).toBe(true);
      expect(
        (mockPrisma as any).userBlockStatus.findFirst
      ).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
    });

    it('returns false when latest entry has status "unblocked"', async () => {
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue({
        status: 'unblocked',
      });

      expect(await repo.isUserBlocked('user-1')).toBe(false);
    });

    it('returns false when no entries exist', async () => {
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue(null);

      expect(await repo.isUserBlocked('user-1')).toBe(false);
    });
  });

  describe('blockUser', () => {
    it('creates entry with status "blocked"', async () => {
      (mockPrisma as any).userBlockStatus.create.mockResolvedValue({});

      await repo.blockUser('user-1', 'admin-1', 'spam activity');

      expect((mockPrisma as any).userBlockStatus.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          status: 'blocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'spam activity',
        },
      });
    });
  });

  describe('unblockUser', () => {
    it('creates entry with status "unblocked"', async () => {
      (mockPrisma as any).userBlockStatus.create.mockResolvedValue({});

      await repo.unblockUser('user-1', 'admin-1', 'no longer suspicious');

      expect((mockPrisma as any).userBlockStatus.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          status: 'unblocked',
          statusChangedBySuperadminId: 'admin-1',
          reason: 'no longer suspicious',
        },
      });
    });
  });

  describe('getBlockStatus', () => {
    it('returns blocked status with reason and date', async () => {
      const blockedAt = new Date('2026-03-01');
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue({
        status: 'blocked',
        reason: 'suspicious',
        createdAt: blockedAt,
      });

      const result = await repo.getBlockStatus('user-1');

      expect(result).toEqual({
        blocked: true,
        reason: 'suspicious',
        blockedAt,
      });
    });

    it('returns unblocked status', async () => {
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue({
        status: 'unblocked',
        reason: null,
        createdAt: new Date(),
      });

      const result = await repo.getBlockStatus('user-1');
      expect(result).toEqual({ blocked: false });
    });

    it('returns null when no entries exist', async () => {
      (mockPrisma as any).userBlockStatus.findFirst.mockResolvedValue(null);

      expect(await repo.getBlockStatus('user-1')).toBeNull();
    });
  });
});
