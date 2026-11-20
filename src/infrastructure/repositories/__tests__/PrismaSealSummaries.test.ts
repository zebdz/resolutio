/** Cards share one lightweight read for every finished poll in the search result. */
import { expect, it, vi } from 'vitest';
import { readPublicSeal, readSealSummaries } from '../PrismaSealSummaries';
import { Digest, PollId as SealPollId } from '@/domain/seal/SealValues';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';

import { PollId } from '@/domain/shared/EntityIds';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';

it('returns simulated and unanchored seals in one batch without reading evidence', async () => {
  const ids = ['one', 'two'].map((id) => PollId.parse(id));
  const rootDigest = Digest.parse('ab'.repeat(32));
  const findMany = vi.fn().mockResolvedValue([
    {
      pollId: ids[0],
      rootDigest,
      anchors: [
        {
          provider: 'stub',
          status: 'SUBMITTED',
          bitcoinHeight: null,
          bitcoinTime: null,
        },
      ],
    },
    { pollId: ids[1], rootDigest, anchors: [] },
  ]);
  const summaries = expectSuccess(await readSealSummaries({ findMany }, ids));
  expect([...summaries.values()]).toEqual([
    { rootDigest, status: { kind: 'simulated' } },
    { rootDigest, status: { kind: 'awaitingSubmission' } },
  ]);
  expect(findMany).toHaveBeenCalledTimes(1);
  const query = findMany.mock.calls[0][0];
  expect(query.where.pollId.in).toEqual(ids);
  expect(Object.keys(query.select).sort()).toEqual([
    'anchors',
    'pollId',
    'rootDigest',
  ]);
  expect(Object.keys(query.select.anchors.select).sort()).toEqual([
    'bitcoinHeight',
    'bitcoinTime',
    'provider',
    'status',
  ]);
});

it('reports a failed status read without discarding the database failure as an unsealed poll', async () => {
  const findMany = vi
    .fn()
    .mockRejectedValue(new Error('test database offline'));
  expect(await readSealSummaries({ findMany }, [PollId.parse('one')])).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});

it('rejects a simulated provider claiming a Bitcoin block', async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      pollId: 'one',
      rootDigest: 'ab'.repeat(32),
      anchors: [
        {
          status: 'CONFIRMED',
          provider: 'stub',
          bitcoinHeight: 123,
          bitcoinTime: new Date(),
        },
      ],
    },
  ]);
  expect(await readSealSummaries({ findMany }, [PollId.parse('one')])).toEqual({
    success: false,
    error: 'domain.seal.inconsistentRecord',
  });
});

it('loads public commitments without querying private sections, proof bytes or anchor diagnostics', async () => {
  const { record } = fixture;
  const manifest = JSON.parse(record.manifest);
  const findUnique = vi.fn().mockResolvedValue({
    manifest: record.manifest,
    rootDigest: record.rootDigest,
    sealedAt: new Date(manifest.sealedAt),
    anchors: [],
    _count: { anchors: 0 },
  });
  const result = await readPublicSeal(
    { findUnique },
    SealPollId.parse(manifest.pollId)
  );
  expect(result).toEqual({
    success: true,
    value: {
      manifest: record.manifest,
      rootDigest: record.rootDigest,
      status: { kind: 'awaitingSubmission' },
      proofAvailable: false,
    },
  });
  const query = findUnique.mock.calls[0][0];
  expect(Object.keys(query.select).sort()).toEqual([
    '_count',
    'anchors',
    'manifest',
    'rootDigest',
    'sealedAt',
  ]);
  expect(Object.keys(query.select.anchors.select).sort()).toEqual([
    'bitcoinHeight',
    'bitcoinTime',
    'provider',
    'status',
  ]);
});
