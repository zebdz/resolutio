/** Immutable seal persistence acceptance: exact canonical bytes survive storage,
 * and database constraints independently reject mutation and invalid anchor states. */
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { SealedRecordBuilder } from '@/domain/seal/SealedRecordBuilder';
import { SealInput } from '@/domain/seal/SealInput';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { PrismaSealWorkRepository } from '../PrismaSealWorkRepository';
import { PrismaSealingTransaction } from '../PrismaSealingTransaction';
import {
  SealLeaseSeconds,
  SealWorkOwner,
} from '@/application/seal/SealWorkRepository';
import { success } from '@/domain/shared/Result';

let db: Awaited<ReturnType<typeof pollDatabase>>;
beforeAll(async () => {
  db = await pollDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function setup() {
  const stamp = randomUUID();
  const user = await db.prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: 'Seal',
      nickname: stamp,
      phoneNumber: stamp,
      password: 'fixture',
    },
  });
  const org = await db.prisma.organization.create({
    data: { name: stamp, description: 'Test', createdById: user.id },
  });
  const row = await db.prisma.poll.create({
    data: {
      title: 'Poll',
      description: '',
      organizationId: org.id,
      createdBy: user.id,
      startDate: new Date(),
      endDate: new Date(),
      state: 'FINISHED',
      finishedAt: new Date(),
    },
  });
  const input: SealInput = {
    ...fixture.input,
    poll: { ...fixture.input.poll, id: row.id },
    votes: fixture.input.votes.map((v) => ({ ...v, pollId: row.id })),
  } as SealInput;
  const seal = expectSuccess(
    SealedRecordBuilder.build(input, new Date(fixture.sealedAt))
  );
  const work = new PrismaSealWorkRepository(db.prisma);
  const claim = expectSuccess(
    await work.acquire(
      seal.pollId,
      SealWorkOwner.parse(stamp),
      SealLeaseSeconds.parse(60)
    )
  );

  if (!claim) {
    return expect.unreachable();
  }

  return {
    seal,
    claim,
    transaction: new PrismaSealingTransaction(db.prisma),
    work,
  };
}

it('round-trips exact bytes and rejects updates/deletes even outside the repository', async () => {
  const { seal, claim, transaction } = await setup();
  expectSuccess(
    await transaction.run(claim, async (scope) => {
      const saved = await scope.seals.save(seal);

      if (!saved.success) {
        return saved;
      }

      const found = expectSuccess(
        await scope.seals.findByRootDigest(seal.rootDigest)
      );
      expect(found?.record).toEqual(seal.record);

      return success(undefined);
    })
  );
  await expect(
    db.prisma
      .$executeRaw`UPDATE poll_seals SET manifest = 'changed' WHERE poll_id = ${seal.pollId}`
  ).rejects.toThrow();
  await expect(
    db.prisma.$executeRaw`DELETE FROM poll_seals WHERE poll_id = ${seal.pollId}`
  ).rejects.toThrow();
});

it('persists failed first submission without proof and atomically supersedes pending anchors', async () => {
  const { seal, claim, transaction } = await setup();
  const { AnchorId, AnchorFailureCode, UtcTimestamp, AnchorProof } =
    await import('@/domain/seal/SealValues');
  const at = UtcTimestamp.parse('2026-09-12T00:00:00.000Z');
  expectSuccess(
    seal.failAnchor({
      id: AnchorId.parse('first'),
      provider: 'opentimestamps',
      at,
      error: AnchorFailureCode.parse('offline'),
    })
  );
  expectSuccess(
    await transaction.run(claim, async (scope) => {
      expectSuccess(await scope.seals.save(seal));

      return scope.seals.saveAnchors(seal, claim.token);
    })
  );
  const restored = expectSuccess(
    await transaction.run(claim, (scope) =>
      scope.seals.findByPollId(seal.pollId)
    )
  );
  expect(restored?.activeAnchor()).toEqual(seal.activeAnchor());
  expectSuccess(
    seal.submitAnchor({
      id: AnchorId.parse('first'),
      provider: 'opentimestamps',
      at: UtcTimestamp.parse('2026-09-12T00:05:00.000Z'),
      evidence: {
        kind: 'pending',
        rootDigest: seal.rootDigest,
        proof: AnchorProof.parse(new Uint8Array([1, 2])),
      },
    })
  );
  expectSuccess(
    await transaction.run(claim, (scope) =>
      scope.seals.saveAnchors(seal, claim.token)
    )
  );
  expectSuccess(
    seal.supersedeAnchor({
      id: AnchorId.parse('replacement'),
      provider: 'opentimestamps',
      at: UtcTimestamp.parse('2026-09-16T00:00:00.000Z'),
      error: AnchorFailureCode.parse('offline'),
    })
  );
  expectSuccess(
    await transaction.run(claim, (scope) =>
      scope.seals.saveAnchors(seal, claim.token)
    )
  );
  const after = expectSuccess(
    await transaction.run(claim, (scope) =>
      scope.seals.findByPollId(seal.pollId)
    )
  );
  expect(after?.anchors).toEqual(seal.anchors);
  await expect(
    db.prisma
      .$executeRaw`UPDATE seal_anchors SET status = 'CONFIRMED' WHERE poll_id = ${seal.pollId} AND id = 'replacement'`
  ).rejects.toThrow();
  await expect(
    db.prisma
      .$executeRaw`UPDATE seal_anchors SET status = 'SUBMITTED', next_attempt_at = submitted_at + interval '10 minutes' WHERE poll_id = ${seal.pollId} AND id = 'first'`
  ).rejects.toThrow();
});

it('rejects a stale worker save after takeover, including anchor writes', async () => {
  const { seal, claim, transaction, work } = await setup();
  expectSuccess(
    await transaction.run(claim, (scope) => scope.seals.save(seal))
  );
  await db.prisma
    .$executeRaw`UPDATE seal_work_claims SET lease_until = clock_timestamp() - interval '1 second' WHERE poll_id = ${seal.pollId}`;
  const replacement = expectSuccess(
    await work.acquire(
      seal.pollId,
      SealWorkOwner.parse(randomUUID()),
      SealLeaseSeconds.parse(60)
    )
  );

  if (!replacement) {
    return expect.unreachable();
  }

  expect(
    await transaction.run(claim, (scope) => scope.seals.save(seal))
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  expect(
    await transaction.run(replacement, (scope) =>
      scope.seals.saveAnchors(seal, claim.token)
    )
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  expectSuccess(
    await transaction.run(replacement, (scope) =>
      scope.seals.saveAnchors(seal, replacement.token)
    )
  );
});

it('reloads the authoritative record after a concurrent unique-insert race', async () => {
  const { seal, claim, transaction } = await setup();
  let inserted = false;
  const result = await transaction.run(claim, async (scope) => {
    const found = expectSuccess(await scope.seals.findByPollId(seal.pollId));

    if (found) {
      return success(found);
    }

    if (!inserted) {
      inserted = true;
      const r = seal.record;
      await db.prisma.pollSeal.create({
        data: {
          pollId: seal.pollId,
          rootDigest: seal.rootDigest,
          manifest: r.manifest,
          sectionPoll: r.sections.poll,
          sectionTallies: r.sections.tallies,
          sectionRegister: r.sections.register,
          sectionSigners: r.sections.signers,
          votes: r.votes.map((v) => ({
            hash: v.hash,
            preimage: { ...v.preimage },
          })),
          sealedAt: new Date(seal.manifest.sealedAt),
        },
      });
    }

    const saved = await scope.seals.save(seal);

    if (!saved.success) {
      return saved;
    }

    return scope.seals.findByPollId(seal.pollId);
  });
  expect(expectSuccess(result)?.record).toEqual(seal.record);
});

it('round-trips confirmed evidence and rejects impossible state combinations', async () => {
  const { seal, claim, transaction } = await setup();
  const { AnchorId, UtcTimestamp, AnchorProof, BitcoinHeight } =
    await import('@/domain/seal/SealValues');
  const id = AnchorId.parse(randomUUID());
  const proof = AnchorProof.parse(new Uint8Array([1, 2, 3]));
  expectSuccess(
    seal.submitAnchor({
      id,
      provider: 'opentimestamps',
      at: UtcTimestamp.parse('2026-09-12T00:00:00.000Z'),
      evidence: { kind: 'pending', rootDigest: seal.rootDigest, proof },
    })
  );
  expectSuccess(
    seal.confirmAnchor(
      {
        kind: 'bitcoin',
        rootDigest: seal.rootDigest,
        proof,
        bitcoinHeight: BitcoinHeight.parse(900000),
        bitcoinTime: UtcTimestamp.parse('2026-09-12T00:01:00.000Z'),
      },
      UtcTimestamp.parse('2026-09-12T01:00:00.000Z')
    )
  );
  expectSuccess(
    await transaction.run(claim, async (scope) => {
      expectSuccess(await scope.seals.save(seal));

      return scope.seals.saveAnchors(seal, claim.token);
    })
  );
  const restored = expectSuccess(
    await transaction.run(claim, (scope) =>
      scope.seals.findByPollId(seal.pollId)
    )
  );
  expect(restored?.activeAnchor()).toEqual(seal.activeAnchor());
  await expect(
    db.prisma.sealAnchor.update({ where: { id }, data: { provider: 'stub' } })
  ).rejects.toThrow();
  await expect(
    db.prisma.sealAnchor.update({
      where: { id },
      data: { confirmedProof: null },
    })
  ).rejects.toThrow();
  await expect(
    db.prisma.sealAnchor.update({ where: { id }, data: { bitcoinHeight: 0 } })
  ).rejects.toThrow();
  await expect(
    db.prisma.sealAnchor.update({ where: { id }, data: { attempts: 0 } })
  ).rejects.toThrow();
});

it('rejects a slow provider result after a newer worker saves its anchor', async () => {
  const { seal, claim, transaction, work } = await setup();
  const { AnchorSealUseCase } =
    await import('@/application/seal/AnchorSealUseCase');
  const { AnchorProof } = await import('@/domain/seal/SealValues');
  const { CryptoIdGenerator, SystemClock } =
    await import('@/infrastructure/shared/SystemEntityCreation');
  const { failure } = await import('@/domain/shared/Result');
  const { AnchorFailureCode } = await import('@/domain/seal/SealValues');
  expectSuccess(
    await transaction.run(claim, (scope) => scope.seals.save(seal))
  );
  expectSuccess(await work.release(claim));
  const newerProof = AnchorProof.parse(new Uint8Array([9, 9]));
  const provider = {
    name: 'opentimestamps' as const,
    submit: async () =>
      success({
        kind: 'pending' as const,
        rootDigest: seal.rootDigest,
        proof: newerProof,
      }),
    upgrade: async () => failure(AnchorFailureCode.parse('not-used')),
  };
  const newer = new AnchorSealUseCase(
    work,
    transaction,
    provider,
    new CryptoIdGenerator(),
    new SystemClock()
  );
  const slow = new AnchorSealUseCase(
    work,
    transaction,
    {
      ...provider,
      submit: async () => {
        // This succeeds only if the network call holds no DB transaction/claim row lock.
        await db.prisma
          .$executeRaw`UPDATE seal_work_claims SET lease_until = clock_timestamp() - interval '1 second' WHERE poll_id = ${seal.pollId}`;
        expectSuccess(
          await newer.execute({
            pollId: seal.pollId,
            owner: SealWorkOwner.parse('newer'),
            lease: SealLeaseSeconds.parse(60),
          })
        );

        return success({
          kind: 'pending' as const,
          rootDigest: seal.rootDigest,
          proof: AnchorProof.parse(new Uint8Array([1])),
        });
      },
    },
    new CryptoIdGenerator(),
    new SystemClock()
  );
  expect(
    await slow.execute({
      pollId: seal.pollId,
      owner: SealWorkOwner.parse('slow'),
      lease: SealLeaseSeconds.parse(60),
    })
  ).toEqual({ success: false, error: 'seal.errors.claimLost' });
  const reader = expectSuccess(
    await work.acquire(
      seal.pollId,
      SealWorkOwner.parse('reader'),
      SealLeaseSeconds.parse(60)
    )
  );

  if (!reader) {
    return expect.unreachable();
  }

  const saved = expectSuccess(
    await transaction.run(reader, (scope) =>
      scope.seals.findByPollId(seal.pollId)
    )
  );
  expect(saved?.activeAnchor()?.pendingProof).toEqual(newerProof);
  expect(saved?.anchors).toHaveLength(1);
});
