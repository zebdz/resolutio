/** Keep the hosted ballot display aligned with offline verification and label provenance. */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyVoteEvidence } from '../VerifyEvidence';
import { evidence } from './evidenceCases';

it('reports original choices with their sealed label, exact weight and pending anchor', () => {
  const result = verifyVoteEvidence(evidence);

  expect(result).toMatchObject({
    success: true,
    value: {
      ballot: 'originalReceiptMatches',
      timestamp: 'pending',
      choices: [
        {
          questionId: 'q2',
          answerId: 'b1',
          weight: '1.234567',
          labels: { kind: 'sealed', question: 'Second?', answer: 'B1' },
        },
        { questionId: 'q1', answerId: 'a1' },
        { questionId: 'q1', answerId: 'a2' },
      ],
    },
  });
});

it('without results access exposes IDs and marks imported labels as receipt claims; a retained canonical poll restores sealed labels', () => {
  const { poll, ...stripped } = JSON.parse(evidence.bundle);
  const bundle = JSON.stringify(stripped);
  const files = { bundle, receipt: evidence.receipt };

  expect(verifyVoteEvidence({ bundle })).toMatchObject({
    value: { choices: [{ labels: { kind: 'unavailable' } }, {}, {}] },
  });
  expect(verifyVoteEvidence(files)).toMatchObject({
    value: {
      choices: [
        { labels: { kind: 'receipt', question: 'Second?', answer: 'B1' } },
        {},
        {},
      ],
    },
  });
  expect(verifyVoteEvidence({ ...files, poll })).toMatchObject({
    value: {
      choices: [
        { labels: { kind: 'sealed', question: 'Second?', answer: 'B1' } },
        {},
        {},
      ],
    },
  });
  expect(
    verifyVoteEvidence({ ...files, poll: poll.replace('Second?', 'Other?') })
  ).toEqual({ success: false, error: 'domain.seal.sectionMismatch' });
});

it('compares the saved weighted ballot while leaving independent Bitcoin block verification to the caller', () => {
  const proof = readFileSync(
    new URL('./fixtures/export-v1/manifest.bitcoin.ots', import.meta.url)
  );
  expect(verifyVoteEvidence({ ...evidence, proof })).toMatchObject({
    success: true,
    value: {
      ballot: 'originalReceiptMatches',
      timestamp: 'bitcoinAttestationUnverified',
    },
  });
});
