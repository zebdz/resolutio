import { Session } from '@/domain/user/Session';
/** Session persistence must preserve the token and instant supplied before creation. */
import { expect, it, vi } from 'vitest';
import { PrismaSessionRepository } from '../PrismaSessionRepository';
import { PrismaClient } from '@/generated/prisma/client';
import { UserId, SessionId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';

it('persists the supplied session identity and creation time', async () => {
  const now = Instant.parse('2026-10-26T10:00:00.000Z');
  const id = SessionId.parse('a'.repeat(64));
  const expiresAt = new Date('2026-10-27T10:00:00.000Z');
  const row = {
    id,
    userId: 'user-1',
    createdAt: Instant.toDate(now),
    expiresAt,
    ipAddress: null,
    userAgent: null,
  };
  const create = vi.fn().mockResolvedValue(row);
  const prisma = { session: { create } } as unknown as PrismaClient;

  await new PrismaSessionRepository(prisma).save(
    Session.create(
      {
        userId: UserId.parse('user-1'),
        expiresAt: Instant.fromDate(expiresAt),
        ipAddress: null,
        userAgent: null,
      },
      { id, now }
    )
  );

  expect(create).toHaveBeenCalledWith({ data: { ...row } });
});
