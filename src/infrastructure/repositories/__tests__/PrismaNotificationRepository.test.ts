/** Notification persistence keeps supplied identity/time and never replaces a first read time. */
import { expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma';
import { Notification } from '@/domain/notification/Notification';
import { NotificationId, UserId, PollId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PrismaNotificationRepository } from '../PrismaNotificationRepository';
import { notificationTestContent } from '@/application/notification/__tests__/notificationTestValues';

it.each(['save', 'saveBatch'] as const)(
  '%s reports a failed append through an explicit Result',
  async (method) => {
    const created = Notification.create(
      { userId: UserId.parse('u-1'), ...notificationTestContent },
      testCreation(NotificationId, 'n-1')
    );

    if (!created.success) {
      return expect.unreachable();
    }

    const prisma = {
      notification: {
        create: vi.fn().mockRejectedValue(new Error('offline')),
        createMany: vi.fn().mockRejectedValue(new Error('offline')),
      },
    } as unknown as PrismaClient;
    const repo = new PrismaNotificationRepository(prisma);
    const result =
      method === 'save'
        ? await repo.save(created.value)
        : await repo.saveBatch([created.value]);
    expect(result).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);

it('persists the caller identity and creation instant', async () => {
  const creation = testCreation(NotificationId, 'assigned-notification');
  const result = Notification.create(
    {
      userId: UserId.parse('u-1'),
      type: 'poll_finished',
      title: 'notification.types.pollFinished.title',
      body: 'notification.types.pollFinished.body',
      data: { pollId: PollId.parse('poll-1'), pollTitle: 'Poll' },
    },
    creation
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const prisma = {
    notification: {
      create: vi.fn(async ({ data }) => ({
        id: 'db-default',
        createdAt: new Date('2030-01-01'),
        ...data,
      })),
    },
  } as unknown as PrismaClient;
  const saved = await new PrismaNotificationRepository(prisma).save(
    result.value
  );

  if (!saved.success) {
    return expect.unreachable();
  }

  expect(saved.value.id).toBe(creation.id);
  expect(saved.value.createdAt.toISOString()).toBe(creation.now);
});
