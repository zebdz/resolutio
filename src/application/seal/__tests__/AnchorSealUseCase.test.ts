/** Application client contracts: provider calls happen outside transactions and
 * persisted domain outcomes retain proof, identity and retry timing across attempts. */
import { expect, it, vi } from 'vitest';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { PollSeal } from '@/domain/seal/PollSeal';
import { AnchorProvider } from '@/domain/seal/AnchorProvider';
import {
  AnchorProof,
  FencingToken,
  UtcTimestamp,
} from '@/domain/seal/SealValues';
import { success } from '@/domain/shared/Result';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import {
  SealLeaseSeconds,
  SealWorkOwner,
  SealWorkRepository,
} from '../SealWorkRepository';
import { SealingTransaction } from '../SealingTransaction';
import { AnchorSealUseCase } from '../AnchorSealUseCase';
import { Instant } from '@/domain/shared/Instant';

function setup() {
  let stored = PollSeal.fromRecord(fixture.record);
  let transactions = 0;
  let now = UtcTimestamp.parse('2026-09-12T00:00:00.000Z');
  const command = {
    pollId: stored.pollId,
    owner: SealWorkOwner.parse('worker'),
    lease: SealLeaseSeconds.parse(60),
  };
  const claim = {
    ...command,
    token: FencingToken.parse(BigInt(1)),
    leaseUntil: UtcTimestamp.parse('2026-09-12T00:01:00.000Z'),
  };
  const work: SealWorkRepository = {
    acquire: vi.fn(async () => success(claim)),
    release: vi.fn(async () => success(true)),
  };
  const transaction: SealingTransaction = {
    async run(_claim, callback) {
      transactions++;
      const copy = expectSuccess(
        PollSeal.reconstitute(stored.record, stored.anchors)
      );
      const result = await callback({
        capturedAt: now,
        snapshot: { read: async () => success(null) },
        seals: {
          save: async () => success(undefined),
          findByPollId: async () => success(copy),
          findByRootDigest: async () => success(copy),
          saveAnchors: async (seal) => {
            stored = expectSuccess(
              PollSeal.reconstitute(seal.record, seal.anchors)
            );

            return success(undefined);
          },
        },
      });
      transactions--;

      return result;
    },
  };
  const pending = {
    kind: 'pending' as const,
    rootDigest: stored.rootDigest,
    proof: AnchorProof.parse(new Uint8Array([1, 2, 3])),
  };
  const provider: AnchorProvider = {
    name: 'opentimestamps',
    submit: vi.fn(async () => {
      expect(transactions).toBe(0);

      return success(pending);
    }),
    upgrade: vi.fn(async () => {
      expect(transactions).toBe(0);

      return success(pending);
    }),
  };
  let nextId = 0;
  const useCase = new AnchorSealUseCase(
    work,
    transaction,
    provider,
    { generate: (identity) => identity.parse(`anchor-${++nextId}`) },
    { now: () => Instant.parse(now) }
  );

  return {
    useCase,
    command,
    provider,
    work,
    stored: () => stored,
    setTime: (value: UtcTimestamp) => {
      now = value;
    },
  };
}

it('submits the manifest digest outside transactions and saves accepted proof once', async () => {
  const f = setup();
  expectSuccess(await f.useCase.execute(f.command));
  expect(f.provider.submit).toHaveBeenCalledExactlyOnceWith(
    f.stored().rootDigest
  );
  expect(f.stored().activeAnchor()).toMatchObject({
    id: 'anchor-1',
    status: 'SUBMITTED',
    attempts: 1,
    pendingProof: new Uint8Array([1, 2, 3]),
  });
  expect(f.stored().record).toEqual(fixture.record);
  expectSuccess(await f.useCase.execute(f.command));
  expect(f.provider.submit).toHaveBeenCalledTimes(1);
  expect(f.work.release).toHaveBeenCalledTimes(2);
});

it('persists submission failure and retries the same anchor only when due', async () => {
  const f = setup();
  const { failure } = await import('@/domain/shared/Result');
  const { AnchorFailureCode } = await import('@/domain/seal/SealValues');
  vi.mocked(f.provider.submit).mockResolvedValueOnce(
    failure(AnchorFailureCode.parse('offline'))
  );
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('failed');
  expect(f.stored().activeAnchor()).toMatchObject({
    id: 'anchor-1',
    status: 'FAILED',
    pendingProof: null,
    nextAttemptAt: '2026-09-12T00:05:00.000Z',
  });
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('idle');
  f.setTime(UtcTimestamp.parse('2026-09-12T00:05:00.000Z'));
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('submitted');
  expect(f.stored().activeAnchor()).toMatchObject({
    id: 'anchor-1',
    attempts: 2,
    status: 'SUBMITTED',
  });
});

it('retains upgraded pending proof and confirms only provider-verified Bitcoin evidence', async () => {
  const f = setup();
  const { BitcoinHeight } = await import('@/domain/seal/SealValues');
  expectSuccess(await f.useCase.execute(f.command));
  f.setTime(UtcTimestamp.parse('2026-09-12T00:10:00.000Z'));
  const proof = AnchorProof.parse(new Uint8Array([4, 5, 6]));
  vi.mocked(f.provider.upgrade).mockResolvedValueOnce(
    success({ kind: 'pending', rootDigest: f.stored().rootDigest, proof })
  );
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('pending');
  expect(f.stored().activeAnchor()).toMatchObject({
    pendingProof: proof,
    submittedAt: '2026-09-12T00:00:00.000Z',
  });
  f.setTime(UtcTimestamp.parse('2026-09-12T00:20:00.000Z'));
  vi.mocked(f.provider.upgrade).mockResolvedValueOnce(
    success({
      kind: 'bitcoin',
      rootDigest: f.stored().rootDigest,
      proof,
      bitcoinHeight: BitcoinHeight.parse(900000),
      bitcoinTime: UtcTimestamp.parse('2026-09-12T00:15:00.000Z'),
    })
  );
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('confirmed');
  expect(f.stored().activeAnchor()).toMatchObject({
    status: 'CONFIRMED',
    bitcoinHeight: 900000,
  });
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('idle');
});

it('records upgrade failure and defers another attempt without losing proof', async () => {
  const f = setup();
  const { failure } = await import('@/domain/shared/Result');
  const { AnchorFailureCode } = await import('@/domain/seal/SealValues');
  expectSuccess(await f.useCase.execute(f.command));
  f.setTime(UtcTimestamp.parse('2026-09-12T00:10:00.000Z'));
  vi.mocked(f.provider.upgrade).mockResolvedValueOnce(
    failure(AnchorFailureCode.parse('offline'))
  );
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('pending');
  expect(f.stored().activeAnchor()).toMatchObject({
    status: 'SUBMITTED',
    pendingProof: new Uint8Array([1, 2, 3]),
    lastError: 'offline',
    nextAttemptAt: '2026-09-12T00:20:00.000Z',
  });
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('idle');
});

it('atomically supersedes old proof even when replacement submission fails', async () => {
  const f = setup();
  const { failure } = await import('@/domain/shared/Result');
  const { AnchorFailureCode } = await import('@/domain/seal/SealValues');
  expectSuccess(await f.useCase.execute(f.command));
  f.setTime(UtcTimestamp.parse('2026-09-15T00:00:00.001Z'));
  vi.mocked(f.provider.submit).mockResolvedValueOnce(
    failure(AnchorFailureCode.parse('offline'))
  );
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('failed');
  expect(f.stored().anchors).toMatchObject([
    { id: 'anchor-1', status: 'SUPERSEDED' },
    { id: 'anchor-2', status: 'FAILED', pendingProof: null },
  ]);
});

it('does no provider work while another worker owns the poll', async () => {
  const f = setup();
  vi.mocked(f.work.acquire).mockResolvedValueOnce(success(null));
  expect(expectSuccess(await f.useCase.execute(f.command))).toBe('busy');
  expect(f.provider.submit).not.toHaveBeenCalled();
  expect(f.work.release).not.toHaveBeenCalled();
});

it('refuses to reuse an anchor with a different configured provider', async () => {
  const f = setup();
  const { AnchorId, AnchorFailureCode } =
    await import('@/domain/seal/SealValues');
  expectSuccess(
    f.stored().failAnchor({
      id: AnchorId.parse('simulated'),
      provider: 'stub',
      at: UtcTimestamp.parse('2026-09-12T00:00:00.000Z'),
      error: AnchorFailureCode.parse('offline'),
    })
  );
  f.setTime(UtcTimestamp.parse('2026-09-12T00:05:00.000Z'));
  expect(await f.useCase.execute(f.command)).toEqual({
    success: false,
    error: 'seal.errors.providerMismatch',
  });
  expect(f.provider.submit).not.toHaveBeenCalled();
  expect(f.work.release).toHaveBeenCalledOnce();
});
