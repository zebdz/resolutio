/** Checked moderation persistence supplies authenticated access decisions and append-only history.
 * These former generic-user repository clients now use the dedicated Result-based port. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import {
  UserBlockEntryId,
  createUserModerationEntry,
} from '@/domain/user/UserModeration';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { getUserModerationAccess } from '@/application/user/getUserModerationAccess';
import type { PrismaClient } from '@/generated/prisma/client';
import { PrismaUserModerationRepository } from '../PrismaUserModerationRepository';

const findFirst = vi.fn();
const create = vi.fn();
const prisma = {
  userBlockStatus: { findFirst, create },
} as unknown as PrismaClient;
const repository = new PrismaUserModerationRepository(prisma);
const userId = UserId.parse('user-1');
const at = Instant.parse('2026-03-01T00:00:00.000Z');

beforeEach(() => {
  vi.resetAllMocks();
});

describe('authenticated user access', () => {
  it('returns blocked when the latest entry has status blocked', async () => {
    findFirst.mockResolvedValue({
      status: 'blocked',
      reason: 'spam',
      createdAt: new Date(at),
    });
    expect(
      expectSuccess(await getUserModerationAccess(repository, userId))
    ).toBe('blocked');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
    );
  });
  it('returns allowed when the latest entry has status unblocked', async () => {
    findFirst.mockResolvedValue({
      status: 'unblocked',
      reason: null,
      createdAt: new Date(at),
    });
    expect(
      expectSuccess(await getUserModerationAccess(repository, userId))
    ).toBe('allowed');
  });
  it('returns allowed when no entries exist', async () => {
    findFirst.mockResolvedValue(null);
    expect(
      expectSuccess(await getUserModerationAccess(repository, userId))
    ).toBe('allowed');
  });
});

describe('moderation history writes', () => {
  it.each(['blocked', 'unblocked'] as const)(
    'appends a %s entry with supplied identity, actor and time',
    async (status) => {
      create.mockResolvedValue({});
      const id = UserBlockEntryId.parse('entry-1');
      const entry = expectSuccess(
        createUserModerationEntry(
          { userId, actorId: 'admin-1', status, reason: 'spam activity' },
          { id, now: at }
        )
      );
      expectSuccess(await repository.append(entry));
      expect(create).toHaveBeenCalledWith({
        data: {
          id,
          userId,
          status,
          statusChangedBySuperadminId: 'admin-1',
          reason: 'spam activity',
          createdAt: new Date(at),
        },
      });
    }
  );
});

describe('checked block status reads', () => {
  it('returns blocked status with its reason and immutable date', async () => {
    findFirst.mockResolvedValue({
      status: 'blocked',
      reason: 'suspicious',
      createdAt: new Date(at),
    });
    expect(expectSuccess(await repository.getStatus(userId))).toEqual({
      blocked: true,
      reason: 'suspicious',
      blockedAt: at,
    });
  });
  it('returns an explicit unblocked status', async () => {
    findFirst.mockResolvedValue({
      status: 'unblocked',
      reason: null,
      createdAt: new Date(at),
    });
    expect(expectSuccess(await repository.getStatus(userId))).toEqual({
      blocked: false,
    });
  });
  it('distinguishes missing history from a failed read', async () => {
    findFirst
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('offline'));
    expect(expectSuccess(await repository.getStatus(userId))).toBeNull();
    expect(await repository.getStatus(userId)).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  });
});
