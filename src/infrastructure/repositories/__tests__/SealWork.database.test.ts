/** PostgreSQL acceptance for exclusive work claims and stale-worker fencing.
 * Real concurrent transactions exercise lease ownership; only a disposable schema is written. */
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import {
  PrismaSealWorkRepository,
  lockSealWorkClaim,
} from '../PrismaSealWorkRepository';
import {
  SealWorkOwner,
  SealLeaseSeconds,
} from '@/application/seal/SealWorkRepository';
import { PollId } from '@/domain/seal/SealValues';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';

let db: Awaited<ReturnType<typeof pollDatabase>>;
beforeAll(async () => {
  db = await pollDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function fixture(finishedAt: Date | null = new Date()) {
  const stamp = randomUUID();
  const user = await db.prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: 'Worker',
      nickname: stamp,
      phoneNumber: stamp,
      password: 'fixture',
    },
  });
  const org = await db.prisma.organization.create({
    data: { name: stamp, description: 'Test', createdById: user.id },
  });
  const poll = await db.prisma.poll.create({
    data: {
      title: 'Test',
      description: 'Test',
      organizationId: org.id,
      createdBy: user.id,
      startDate: new Date(),
      endDate: new Date(),
      state: 'FINISHED',
      finishedAt,
    },
  });

  return PollId.parse(poll.id);
}

const owner = SealWorkOwner.parse('worker-1');
const other = SealWorkOwner.parse('worker-2');
const duration = SealLeaseSeconds.parse(60);

it('grants exactly one concurrent claim and retains fencing tokens after release', async () => {
  const pollId = await fixture();
  const repo = new PrismaSealWorkRepository(db.prisma);
  const results = await Promise.all([
    repo.acquire(pollId, owner, duration),
    repo.acquire(pollId, other, duration),
  ]);
  const claims = results.map(expectSuccess).filter((c) => c !== null);
  expect(claims).toHaveLength(1);
  const first = claims[0];
  expect(
    await repo.release({
      ...first,
      owner: first.owner === owner ? other : owner,
    })
  ).toEqual({ success: true, value: false });
  expect(await repo.release(first)).toEqual({ success: true, value: true });
  const second = expectSuccess(await repo.acquire(pollId, other, duration));
  expect(second?.token).toBe(first.token + BigInt(1));
  expect(await repo.release(first)).toEqual({ success: true, value: false });
});

it('rejects expired claims even before a replacement, and fences old owners after takeover', async () => {
  const pollId = await fixture();
  const repo = new PrismaSealWorkRepository(db.prisma);
  const first = expectSuccess(await repo.acquire(pollId, owner, duration));

  if (!first) {
    return expect.unreachable();
  }

  await db.prisma
    .$executeRaw`UPDATE seal_work_claims SET lease_until = clock_timestamp() - interval '1 second' WHERE poll_id = ${pollId}`;
  expect(
    await db.prisma.$transaction((tx) => lockSealWorkClaim(tx, first))
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  const second = expectSuccess(await repo.acquire(pollId, other, duration));

  if (!second) {
    return expect.unreachable();
  }

  expect(second.token).toBe(first.token + BigInt(1));
  expect(
    await db.prisma.$transaction((tx) => lockSealWorkClaim(tx, first))
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  expect(
    await db.prisma.$transaction((tx) =>
      lockSealWorkClaim(tx, { ...second, owner })
    )
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  expect(
    await db.prisma.$transaction((tx) => lockSealWorkClaim(tx, second))
  ).toEqual({ success: true, value: undefined });
});

it('checks expiry after waiting for the row lock', async () => {
  const pollId = await fixture();
  const repo = new PrismaSealWorkRepository(db.prisma);
  const claim = expectSuccess(await repo.acquire(pollId, owner, duration));

  if (!claim) {
    return expect.unreachable();
  }

  await db.pool.query(
    "UPDATE seal_work_claims SET lease_until = clock_timestamp() + interval '1 second' WHERE poll_id = $1",
    [pollId]
  );
  const blocker = await db.pool.connect();
  await blocker.query('BEGIN');
  await blocker.query(
    'SELECT poll_id FROM seal_work_claims WHERE poll_id = $1 FOR UPDATE',
    [pollId]
  );
  const waiting = db.prisma.$transaction((tx) => lockSealWorkClaim(tx, claim));

  try {
    await db.waitForBlockedWriters(1);
    await blocker.query(
      'SELECT pg_sleep(GREATEST(0, extract(epoch FROM lease_until - clock_timestamp())) + 0.05) FROM seal_work_claims WHERE poll_id = $1',
      [pollId]
    );
  } finally {
    await blocker.query('ROLLBACK');
    blocker.release();
  }

  expect(await waiting).toEqual({
    success: false,
    error: 'seal.errors.claimLost',
  });
});

it('allows only one lazy nudge in ten minutes across workers and restarts', async () => {
  const pollId = await fixture();
  const repo = new PrismaSealWorkRepository(db.prisma);
  const claim = expectSuccess(
    await repo.acquire(pollId, owner, duration, 'lazy')
  );

  if (!claim) {
    return expect.unreachable();
  }

  expectSuccess(await repo.release(claim));
  const restarted = new PrismaSealWorkRepository(db.prisma);
  expect(
    expectSuccess(await restarted.acquire(pollId, other, duration, 'lazy'))
  ).toBeNull();
  const cron = expectSuccess(await restarted.acquire(pollId, other, duration));

  if (!cron) {
    return expect.unreachable();
  }

  expectSuccess(await restarted.release(cron));
  await db.pool.query(
    "UPDATE seal_work_claims SET last_nudged_at = CURRENT_TIMESTAMP - interval '10 minutes' WHERE poll_id = $1",
    [pollId]
  );
  expect(
    expectSuccess(await restarted.acquire(pollId, other, duration, 'lazy'))
  ).not.toBeNull();
});

it('discovers eligible missing seals and rotates a failed attempt behind untouched polls', async () => {
  const first = await fixture();
  const second = await fixture();
  const historic = await fixture(null);
  const repo = new PrismaSealWorkRepository(db.prisma);
  expect(expectSuccess(await repo.discover(1, historic))).toEqual([]);
  expect(expectSuccess(await repo.discover(1, second))).toEqual([
    { pollId: second, kind: 'seal' },
  ]);
  const claim = expectSuccess(await repo.acquire(first, owner, duration));

  if (!claim) {
    return expect.unreachable();
  }

  expect(expectSuccess(await repo.discover(1, first))).toEqual([]);
  expectSuccess(await repo.release(claim));
  const items = expectSuccess(await repo.discover(100));
  expect(items.findIndex((i) => i.pollId === second)).toBeLessThan(
    items.findIndex((i) => i.pollId === first)
  );
});
