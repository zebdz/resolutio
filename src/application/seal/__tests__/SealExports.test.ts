/** End-user export contracts. Membership loss may remove labels while the original
 * voter keeps their own inclusion proof. No other ballots or signer data travel with it. */
import { it, expect } from 'vitest';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { PollSeal } from '@/domain/seal/PollSeal';
import {
  UserId,
  PollId,
  AnchorProof,
  AnchorId,
  BitcoinHeight,
  UtcTimestamp,
} from '@/domain/seal/SealValues';
import { success } from '@/domain/shared/Result';
import { canonical } from '@/domain/seal/Canonical';
import { verifyEvidence } from '@/domain/seal/VerifyEvidence';
import { SealExports } from '../SealExports';

const seal = PollSeal.fromRecord(fixture.record);
const receipt = JSON.parse(fixture.receipt);
const pollId = PollId.parse(receipt.pollId);
const userId = UserId.parse(receipt.userId);
const exportsFor = (
  results: boolean,
  names: boolean,
  signers: boolean,
  stored = seal,
  attachments = results
) =>
  new SealExports(
    {
      findByPollId: async () => success(stored),
      findPublishedByPollId: async () =>
        success({
          manifest: stored.manifestBytes,
          rootDigest: stored.rootDigest,
          anchor: stored.activeAnchor(),
        }),
    },
    { forViewer: async () => success({ results, names, signers, attachments }) }
  );
it('returns only sealed own leaves after loss of results access', async () => {
  const api = exportsFor(false, false, false);
  const result = await api.myProof(pollId, userId);
  expect(result.success).toBe(true);

  if (!result.success) {
    throw Error(result.error);
  }

  const bundle = result.value;
  expect(bundle.manifest).toBe(fixture.record.manifest);
  expect(bundle.leaves.map((l) => l.hash)).toEqual(
    receipt.leaves.map((l: { hash: string }) => l.hash)
  );
  expect(bundle.leaves.every((l) => l.preimage.userId === userId)).toBe(true);
  expect(bundle).not.toHaveProperty('poll');
  expect(JSON.stringify(bundle)).not.toContain(receipt.receiptSecret);
  expect(await api.sections(pollId, userId)).toMatchObject({
    success: false,
    error: 'seal.errors.forbidden',
  });
});

it('serves upgraded bytes and public block metadata after the provider confirms', async () => {
  const stored = PollSeal.fromRecord(fixture.record);
  const api = exportsFor(false, false, false, stored);
  const at = UtcTimestamp.parse(fixture.sealedAt);
  const pending = AnchorProof.parse(Uint8Array.of(1));
  const confirmed = AnchorProof.parse(Uint8Array.of(2));
  const height = BitcoinHeight.parse(900000);
  expect(
    stored.submitAnchor({
      id: AnchorId.parse('anchor1'),
      provider: 'opentimestamps',
      at,
      evidence: {
        kind: 'pending',
        rootDigest: stored.rootDigest,
        proof: pending,
      },
    }).success
  ).toBe(true);
  expect(await api.proof(pollId)).toEqual({
    success: true,
    value: { bytes: pending, status: 'pending' },
  });
  expect(
    stored.confirmAnchor(
      {
        kind: 'bitcoin',
        rootDigest: stored.rootDigest,
        proof: confirmed,
        bitcoinHeight: height,
        bitcoinTime: at,
      },
      at
    ).success
  ).toBe(true);
  expect(await api.proof(pollId)).toEqual({
    success: true,
    value: { bytes: confirmed, status: 'bitcoin' },
  });
  expect(await api.publicRecord(pollId)).toMatchObject({
    success: true,
    value: { status: { kind: 'bitcoin', height, time: at } },
  });
});

it('withholds file metadata from a results viewer outside the file audience', async () => {
  const api = exportsFor(true, true, false, seal, false);
  const sections = await api.sections(pollId, userId);
  const bundle = await api.myProof(pollId, userId);

  if (!sections.success || !bundle.success) {
    throw Error('missing evidence');
  }

  expect(sections.value.sections).toHaveProperty('votes');
  expect(sections.value.sections).not.toHaveProperty('poll');
  expect(bundle.value).not.toHaveProperty('poll');
  expect(
    verifyEvidence({
      sections: canonical(sections.value),
      bundle: canonical(bundle.value),
    })
  ).toMatchObject({
    success: true,
    value: { labels: 'unavailable', talliesRecomputed: false },
  });
});
