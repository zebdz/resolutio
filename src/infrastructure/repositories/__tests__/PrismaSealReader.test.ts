/** A storage outage cannot masquerade as an absent seal. Exercise the Prisma
 * read port with a failing query without opening a database connection. */
import { expect, it, vi } from 'vitest';
import { SealWorkOwner } from '@/application/seal/SealWorkRepository';
import { Prisma } from '@/generated/prisma/client';
import { PrismaPollSealRepository } from '../PrismaPollSealRepository';
import { FencingToken, UtcTimestamp, PollId } from '@/domain/seal/SealValues';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaSealReader } from '../PrismaSealReader';

vi.mock('@/infrastructure/database/prisma', () => ({
  prisma: { pollSeal: { findUnique: vi.fn() } },
}));
it.each(['findByPollId', 'findPublishedByPollId'] as const)(
  'returns a typed storage failure when %s cannot query PostgreSQL',
  async (method) => {
    vi.mocked(prisma.pollSeal.findUnique).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('database unavailable', {
        code: 'P1001',
        clientVersion: 'test',
      })
    );
    const reader = new PrismaSealReader(prisma);
    expect(await reader[method](PollId.parse('poll1'))).toEqual({
      success: false,
      error: 'common.errors.unexpected',
    });
  }
);

it('preserves a retriable PostgreSQL conflict inside a sealing transaction', async () => {
  const conflict = new Prisma.PrismaClientKnownRequestError(
    'retry transaction',
    { code: 'P2034', clientVersion: 'test' }
  );
  vi.mocked(prisma.pollSeal.findUnique).mockRejectedValue(conflict);
  const pollId = PollId.parse('poll1');
  const transactional = new PrismaPollSealRepository(prisma, {
    pollId,
    token: FencingToken.parse(BigInt(1)),
    owner: SealWorkOwner.parse('test'),
    leaseUntil: UtcTimestamp.parse('2026-10-01T00:00:00.000Z'),
  });
  await expect(transactional.findByPollId(pollId)).rejects.toBe(conflict);
});

it('does not convert a programming fault in the query into a storage result', async () => {
  const fault = new TypeError('unexpected client implementation fault');
  vi.mocked(prisma.pollSeal.findUnique).mockRejectedValue(fault);
  await expect(
    new PrismaSealReader(prisma).findByPollId(PollId.parse('poll1'))
  ).rejects.toBe(fault);
});
