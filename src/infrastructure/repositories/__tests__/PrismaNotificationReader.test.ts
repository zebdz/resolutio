/** Inbox reads decode complete stored events and report unavailable/invalid state explicitly.
 * Prisma mocks isolate query failures; no malformed row may turn into a successful empty inbox. */
import { beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import { UserId } from '@/domain/shared/EntityIds';
import { ResultLimit } from '@/domain/shared/Pagination';
import { NotificationOffset } from '@/domain/notification/NotificationContent';
import { PrismaNotificationReader } from '../PrismaNotificationReader';

const findMany = vi.fn();
const count = vi.fn();
const prisma = { notification: { findMany, count } } as unknown as PrismaClient;
const reader = new PrismaNotificationReader(prisma);
const userId = UserId.parse('user-1');
const row = {
  id: 'notification-1',
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
  findMany.mockResolvedValue([row]);
  count.mockResolvedValue(2);
});
it('returns restored events scoped to the recipient with paging/order preserved', async () => {
  const result = await reader.findByUserId(userId, {
    limit: ResultLimit.parse(10),
    offset: NotificationOffset.parse(2),
  });
  expect(result.success).toBe(true);

  if (!result.success) {
    return expect.unreachable();
  }

  expect(result.value.map((item) => item.toJSON())).toEqual([row]);
  expect(findMany).toHaveBeenCalledWith({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    skip: 2,
  });
});
it('returns validated unread/total counts with separate recipient query scopes', async () => {
  expect(await reader.getUnreadCount(userId)).toEqual({
    success: true,
    value: 2,
  });
  expect(count).toHaveBeenLastCalledWith({ where: { userId, readAt: null } });
  expect(await reader.getCountByUserId(userId)).toEqual({
    success: true,
    value: 2,
  });
  expect(count).toHaveBeenLastCalledWith({ where: { userId } });
});
it('distinguishes a valid empty inbox and zero counts', async () => {
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
  expect(await reader.findByUserId(userId)).toEqual({
    success: true,
    value: [],
  });
  expect(await reader.getUnreadCount(userId)).toEqual({
    success: true,
    value: 0,
  });
  expect(await reader.getCountByUserId(userId)).toEqual({
    success: true,
    value: 0,
  });
});
it.each([
  { id: '' },
  { userId: '' },
  { type: 'unknown' },
  { data: { pollTitle: 'Missing poll ID' } },
  { createdAt: new Date(NaN) },
  { readAt: new Date(NaN) },
])('rejects an entire inbox with a malformed row: %o', async (invalid) => {
  findMany.mockResolvedValue([row, { ...row, ...invalid }]);
  expect(await reader.findByUserId(userId)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it('returns a failed read when a list query rejects', async () => {
  findMany.mockRejectedValue(new Error('database offline'));
  expect(await reader.findByUserId(userId)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
it.each(['getUnreadCount', 'getCountByUserId'] as const)(
  '%s rejects malformed counts and translates query failures',
  async (method) => {
    for (const value of [-1, 0.5, NaN, Infinity, '2']) {
      count.mockResolvedValue(value);
      expect(await reader[method](userId)).toEqual({
        success: false,
        error: 'common.errors.unexpected',
      });
    }

    count.mockRejectedValue(new Error('database offline'));
    expect(await reader[method](userId)).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);
