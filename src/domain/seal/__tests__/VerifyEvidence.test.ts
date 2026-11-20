/** Independent receipt verification across saved bytes, selective disclosure and timestamp binding. */
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Digest } from '../SealValues';
import { inspectTimestamp } from '../TimestampBinding';
import { verifyEvidence } from '../VerifyEvidence';

import { canonical } from '../Canonical';
import {
  evidence,
  invalidCases,
  code,
  replacementBallot,
} from './evidenceCases';

it('verifies all original leaves and their sealed labels while a bound calendar proof remains pending', () => {
  expect(verifyEvidence(evidence)).toMatchObject({
    success: true,
    value: {
      ballot: 'originalReceiptMatches',
      labels: 'verified',
      timestamp: 'pending',
      verifiedSections: ['poll', 'tallies'],
    },
  });
});

it.each(invalidCases)('rejects %s', (_, files, error) => {
  expect(verifyEvidence(files)).toEqual({
    success: false,
    error: 'domain.seal.' + error,
  });
});
it('reports code-only and receipt-free inclusion with their actual guarantees', () => {
  for (const bundle of [evidence.bundle, replacementBallot]) {
    expect(verifyEvidence({ bundle, code })).toMatchObject({
      success: true,
      value: { ballot: 'codeMatchesCurrentRecord', timestamp: 'notProvided' },
    });
    expect(verifyEvidence({ bundle })).toMatchObject({
      success: true,
      value: { ballot: 'includedLeaves' },
    });
  }
});
it('authenticates labels only against an available committed poll section', () => {
  const stripped = JSON.parse(evidence.bundle);
  const retained = stripped.poll;
  delete stripped.poll;
  const files = { bundle: canonical(stripped), receipt: evidence.receipt };
  expect(verifyEvidence(files)).toMatchObject({
    success: true,
    value: { ballot: 'originalReceiptMatches', labels: 'unavailable' },
  });
  expect(verifyEvidence({ ...files, poll: retained })).toMatchObject({
    success: true,
    value: { labels: 'verified' },
  });
});
it('reports simulated bytes as simulated and leaves real Bitcoin verification to ots', () => {
  const proof = new TextEncoder().encode(
    'SIMULATED:' + JSON.parse(evidence.bundle).rootDigest
  );
  expect(verifyEvidence({ ...evidence, proof })).toMatchObject({
    success: true,
    value: { timestamp: 'simulated' },
  });
});

it('reports the historical Bitcoin attestation as unverified offline', () => {
  const bytes = readFileSync(
    new URL(
      '../../../infrastructure/anchor/__tests__/fixtures/hello-world.txt.ots',
      import.meta.url
    )
  );
  const digest = Digest.parse(
    '03ba204e50d126e4674c005e04d82e84c21366780af1f43bd54a37816b6ab340'
  );
  expect(inspectTimestamp(bytes, digest)).toEqual({
    success: true,
    value: 'bitcoinAttestationUnverified',
  });
});
