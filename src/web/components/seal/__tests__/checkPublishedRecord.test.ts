/** Compare the public browser checks with the CLI fixture, using only read-only same-origin requests. */
import { expect, it, vi } from 'vitest';
import { evidence } from '@/domain/seal/__tests__/evidenceCases';
import { checkPublishedRecord } from '../checkPublishedRecord';

it('checks only the viewer’s disclosed section hashes and a pending timestamp', async () => {
  const get = vi.fn(
    async (url: string) =>
      new Response(url.endsWith('/proof') ? evidence.proof : evidence.sections)
  );
  const result = await checkPublishedRecord(
    {
      pollId: 'poll1',
      manifest: evidence.manifest,
      rootDigest: JSON.parse(evidence.bundle).rootDigest,
      hasProof: true,
      canReadSections: true,
    },
    undefined,
    get
  );
  expect(get.mock.calls.map(([url]) => url).sort()).toEqual([
    '/api/polls/poll1/seal/proof',
    '/api/polls/poll1/seal/sections',
  ]);
  expect(result).toMatchObject({
    success: true,
    value: { verifiedSections: ['poll', 'tallies'], timestamp: 'pending' },
  });
});

it('rejects a displayed root digest that differs from the computed manifest digest', async () => {
  const result = await checkPublishedRecord({
    pollId: 'poll1',
    manifest: evidence.manifest,
    rootDigest: '0'.repeat(64),
    hasProof: false,
    canReadSections: false,
  });
  expect(result).toEqual({
    success: false,
    error: 'domain.seal.manifestMismatch',
  });
});

const published = {
  pollId: 'poll1',
  rootDigest: JSON.parse(evidence.bundle).rootDigest,
  manifest: evidence.manifest,
  hasProof: false,
  canReadSections: false,
};
it('keeps selected evidence local and rejects a byte-order mark exactly like the standalone verifier', async () => {
  const get = vi.fn();
  const saved = new File([evidence.sections], 'sections.json');
  expect(await checkPublishedRecord(published, saved, get)).toMatchObject({
    success: true,
    value: { verifiedSections: ['poll', 'tallies'], timestamp: 'notProvided' },
  });
  const changed = new File(['\uFEFF', evidence.sections], 'sections.json');
  expect(await checkPublishedRecord(published, changed, get)).toEqual({
    success: false,
    error: 'domain.seal.invalidCanonical',
  });
  expect(get).not.toHaveBeenCalled();
});
it('reports a lost permission at download time without claiming verification', async () => {
  const get = vi.fn(async () => new Response(null, { status: 403 }));
  expect(
    await checkPublishedRecord(
      { ...published, canReadSections: true },
      undefined,
      get
    )
  ).toEqual({ success: false, error: 'sealPublic.downloadUnavailable' });
});
it('labels a simulated proof and checks only public commitments when no sections are provided', async () => {
  const get = vi.fn(
    async () => new Response('SIMULATED:' + published.rootDigest)
  );
  expect(
    await checkPublishedRecord({ ...published, hasProof: true }, undefined, get)
  ).toMatchObject({
    success: true,
    value: { verifiedSections: [], timestamp: 'simulated' },
  });
});
