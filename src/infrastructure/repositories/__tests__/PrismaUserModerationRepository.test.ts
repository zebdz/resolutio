/** Moderation storage preserves append-only records and rejects invalid persisted states.
 * Legacy nullable/empty reasons remain readable; database failures never escape as rejections. */
import { expect, it, vi } from 'vitest';
import type { PrismaClient } from '@/generated/prisma/client';
import { UserId } from '@/domain/shared/EntityIds';
import {
  createUserModerationEntry,
  UserBlockEntryId,
} from '@/domain/user/UserModeration';
import { Instant } from '@/domain/shared/Instant';
import { PrismaUserModerationRepository } from '../PrismaUserModerationRepository';
const at = Instant.parse('2026-11-04T12:00:00.000Z');

function fixture() {
  const db = { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() };
  const queryRaw = vi.fn();
  const repo = new PrismaUserModerationRepository({
    userBlockStatus: db,
    $queryRaw: queryRaw,
  } as unknown as PrismaClient);

  return { db, repo, queryRaw };
}

it('appends the supplied identity, time and exact reason', async () => {
  const { db, repo } = fixture();
  const entry = createUserModerationEntry(
    { userId: 'target', actorId: 'admin', status: 'blocked', reason: ' Spam ' },
    { id: UserBlockEntryId.parse('entry-1'), now: at }
  );
  expect(entry.success).toBe(true);

  if (!entry.success) {
    return;
  }

  expect(await repo.append(entry.value)).toEqual({
    success: true,
    value: undefined,
  });
  expect(db.create).toHaveBeenCalledWith({
    data: {
      id: 'entry-1',
      userId: 'target',
      status: 'blocked',
      statusChangedBySuperadminId: 'admin',
      reason: ' Spam ',
      createdAt: new Date(at),
    },
  });
});
it.each([null, ''])(
  'preserves historical blocked reason %j',
  async (reason) => {
    const { db, repo } = fixture();
    db.findFirst.mockResolvedValue({
      status: 'blocked',
      reason,
      createdAt: new Date(at),
    });
    expect(await repo.getStatus(UserId.parse('target'))).toEqual({
      success: true,
      value: { blocked: true, reason: reason ?? undefined, blockedAt: at },
    });
  }
);
it('distinguishes missing, unblocked and invalid stored status', async () => {
  const { db, repo } = fixture();
  db.findFirst
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      status: 'unblocked',
      reason: null,
      createdAt: new Date(at),
    })
    .mockResolvedValueOnce({
      status: 'unknown',
      reason: null,
      createdAt: new Date(at),
    });
  expect(await repo.getStatus(UserId.parse('target'))).toEqual({
    success: true,
    value: null,
  });
  expect(await repo.getStatus(UserId.parse('target'))).toEqual({
    success: true,
    value: { blocked: false },
  });
  expect(await repo.getStatus(UserId.parse('target'))).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('decodes history without weakening identity/status/profile types', async () => {
  const { db, repo } = fixture();
  const row = {
    id: 'entry-1',
    status: 'blocked',
    reason: '',
    createdAt: new Date(at),
    statusChangedBy: {
      firstName: 'Alice',
      lastName: 'Smith',
      middleName: null,
    },
  };
  db.findMany
    .mockResolvedValueOnce([row])
    .mockResolvedValueOnce([{ ...row, id: '' }]);
  expect(await repo.getHistory(UserId.parse('target'))).toEqual({
    success: true,
    value: [{ ...row, createdAt: at }],
  });
  expect(await repo.getHistory(UserId.parse('target'))).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('returns explicit failures for failed reads and writes', async () => {
  const { db, repo } = fixture();

  for (const query of Object.values(db)) {
    query.mockRejectedValue(new Error('private driver detail'));
  }

  expect(await repo.getStatus(UserId.parse('target'))).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  expect(await repo.getHistory(UserId.parse('target'))).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  const entry = createUserModerationEntry(
    {
      userId: 'target',
      actorId: 'admin',
      status: 'unblocked',
      reason: 'Resolved',
    },
    { id: UserBlockEntryId.parse('entry-2'), now: at }
  );

  if (entry.success) {
    expect(await repo.append(entry.value)).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
});

it('decodes a batch of latest statuses and preserves missing users as absent', async () => {
  const { db, repo } = fixture();
  db.findMany.mockResolvedValue([
    { userId: 'a', status: 'blocked', reason: '', createdAt: new Date(at) },
    { userId: 'b', status: 'unblocked', reason: null, createdAt: new Date(at) },
  ]);
  const result = await repo.getStatuses([
    UserId.parse('a'),
    UserId.parse('b'),
    UserId.parse('absent'),
  ]);
  expect(result.success).toBe(true);

  if (result.success) {
    expect([...result.value]).toEqual([
      ['a', { blocked: true, reason: '', blockedAt: at }],
      ['b', { blocked: false }],
    ]);
    expect(result.value.has(UserId.parse('absent'))).toBe(false);
  }
});
it('rejects malformed bulk statuses and failed batch reads', async () => {
  const { db, repo } = fixture();
  db.findMany
    .mockResolvedValueOnce([
      { userId: 'a', status: 'unknown', reason: null, createdAt: new Date(at) },
    ])
    .mockRejectedValueOnce(new Error('driver detail'));
  expect(await repo.getStatuses([UserId.parse('a')])).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  expect(await repo.getStatuses([UserId.parse('a')])).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('does not query for an empty requested user set', async () => {
  const { db, repo } = fixture();
  expect(await repo.getStatuses([])).toEqual({
    success: true,
    value: new Map(),
  });
  expect(db.findMany).not.toHaveBeenCalled();
});

it('returns only blocked IDs from decoded latest statuses', async () => {
  const { queryRaw, repo } = fixture();
  queryRaw.mockResolvedValue([
    { user_id: 'a', status: 'blocked' },
    { user_id: 'b', status: 'unblocked' },
  ]);
  expect(await repo.getBlockedUserIds()).toEqual({
    success: true,
    value: ['a'],
  });
});
it.each([
  { user_id: 'a', status: 'unknown' },
  { user_id: '', status: 'blocked' },
])('rejects invalid latest filter row %j', async (row) => {
  const { queryRaw, repo } = fixture();
  queryRaw.mockResolvedValue([row]);
  expect(await repo.getBlockedUserIds()).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('propagates failed blocked-ID queries', async () => {
  const { queryRaw, repo } = fixture();
  queryRaw.mockRejectedValue(new Error('driver detail'));
  expect(await repo.getBlockedUserIds()).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
