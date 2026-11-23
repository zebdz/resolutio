/** Recipient persistence preserves first-read timestamps and scopes writes to the authorized user.
 * Query/decoding failures remain explicit and malformed selections never become partial success. */
import { beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import { NotificationId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { PrismaNotificationRecipientRepository } from '../PrismaNotificationRecipientRepository';

const queries = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};
const prisma = { notification: queries } as unknown as PrismaClient;
const repository = new PrismaNotificationRecipientRepository(prisma);
const id = NotificationId.parse('notification-1');
const userId = UserId.parse('user-1');
const now = Instant.parse('2026-11-04T12:00:00.000Z');
const row = {
  id,
  userId,
  type: 'poll_finished',
  title: 'notification.types.pollFinished.title',
  body: 'notification.types.pollFinished.body',
  data: { pollId: 'poll-1', pollTitle: ' Poll ' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  readAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  queries.findUnique.mockResolvedValue(row);
  queries.findMany.mockResolvedValue([row]);
  queries.updateMany.mockResolvedValue({ count: 1 });
  queries.deleteMany.mockResolvedValue({ count: 1 });
});
it('marks only the authorized recipient’s unread notification at the supplied instant', async () => {
  expect(await repository.markAsRead(id, userId, now)).toEqual({
    success: true,
    value: undefined,
  });
  expect(queries.updateMany).toHaveBeenCalledWith({
    where: { id, userId, readAt: null },
    data: { readAt: new Date(now) },
  });
});
it('loads a validated notification and distinguishes an absent record', async () => {
  const loaded = await repository.findById(id);

  if (!loaded.success || loaded.value === null) {
    return expect.unreachable();
  }

  expect(loaded.value.toJSON()).toEqual(row);
  expect(queries.findUnique).toHaveBeenCalledWith({ where: { id } });
  queries.findUnique.mockResolvedValue(null);
  expect(await repository.findById(id)).toEqual({ success: true, value: null });
});
it('loads the complete selected set using validated notification IDs', async () => {
  const loaded = await repository.findByIds([id]);

  if (!loaded.success) {
    return expect.unreachable();
  }

  expect(loaded.value.map((notification) => notification.toJSON())).toEqual([
    row,
  ]);
  expect(queries.findMany).toHaveBeenCalledWith({
    where: { id: { in: [id] } },
  });
});
it.each([
  { id: '' },
  { type: 'unknown' },
  { readAt: new Date(NaN) },
  { data: null },
])(
  'rejects malformed records without returning partial success: %o',
  async (invalid) => {
    queries.findUnique.mockResolvedValue({ ...row, ...invalid });
    queries.findMany.mockResolvedValue([row, { ...row, ...invalid }]);
    expect(await repository.findById(id)).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
    expect(await repository.findByIds([id])).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);
it.each(['findById', 'findByIds'] as const)(
  '%s translates query rejection',
  async (method) => {
    queries.findUnique.mockRejectedValue(new Error('unavailable'));
    queries.findMany.mockRejectedValue(new Error('unavailable'));
    const result =
      method === 'findById'
        ? await repository.findById(id)
        : await repository.findByIds([id]);
    expect(result).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);
it('marks only the recipient’s unread rows without replacing previous read times', async () => {
  expect(await repository.markAllAsRead(userId, now)).toEqual({
    success: true,
    value: undefined,
  });
  expect(queries.updateMany).toHaveBeenCalledWith({
    where: { userId, readAt: null },
    data: { readAt: new Date(now) },
  });
});
it('deletes only the selected recipient’s rows', async () => {
  expect(await repository.deleteByIds([id], userId)).toEqual({
    success: true,
    value: undefined,
  });
  expect(queries.deleteMany).toHaveBeenCalledWith({
    where: { id: { in: [id] }, userId },
  });
});
it('keeps empty reads/deletes as successful no-ops', async () => {
  expect(await repository.findByIds([])).toEqual({ success: true, value: [] });
  expect(await repository.deleteByIds([], userId)).toEqual({
    success: true,
    value: undefined,
  });
  expect(queries.findMany).not.toHaveBeenCalled();
  expect(queries.deleteMany).not.toHaveBeenCalled();
});
it('retains idempotent success when a concurrent deletion/read left no rows to change', async () => {
  queries.updateMany.mockResolvedValue({ count: 0 });
  queries.deleteMany.mockResolvedValue({ count: 0 });
  expect(await repository.markAsRead(id, userId, now)).toEqual({
    success: true,
    value: undefined,
  });
  expect(await repository.markAllAsRead(userId, now)).toEqual({
    success: true,
    value: undefined,
  });
  expect(await repository.deleteByIds([id], userId)).toEqual({
    success: true,
    value: undefined,
  });
});
it.each(['markAsRead', 'markAllAsRead', 'deleteByIds'] as const)(
  '%s reports failed persistence',
  async (method) => {
    queries.updateMany.mockRejectedValue(new Error('unavailable'));
    queries.deleteMany.mockRejectedValue(new Error('unavailable'));
    const result =
      method === 'markAsRead'
        ? await repository.markAsRead(id, userId, now)
        : method === 'markAllAsRead'
          ? await repository.markAllAsRead(userId, now)
          : await repository.deleteByIds([id], userId);
    expect(result).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);
