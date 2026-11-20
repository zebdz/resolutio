/** Exercise the exact file-import path used by the hosted voter verifier against the CLI fixture. */
import { expect, it } from 'vitest';
import { code, evidence } from '@/domain/seal/__tests__/evidenceCases';
import { checkLocalBallot } from '../localBallotCheck';

it('verifies a saved receipt and a retained sections export without authorized poll labels', async () => {
  const { poll: _poll, ...blind } = JSON.parse(evidence.bundle);
  const result = await checkLocalBallot({
    bundle: JSON.stringify(blind),
    proof: Array.from(evidence.proof),
    input: {
      kind: 'receipt',
      file: new File([evidence.receipt], 'receipt.json'),
    },
    labelsFile: new File([evidence.sections], 'sections.json'),
  });
  expect(result).toMatchObject({
    success: true,
    value: {
      ballot: 'originalReceiptMatches',
      labels: 'verified',
      timestamp: 'pending',
    },
  });
});

it('keeps code-only verification at current-record inclusion', async () => {
  const result = await checkLocalBallot({
    bundle: evidence.bundle,
    proof: null,
    input: { kind: 'current', code },
    labelsFile: null,
  });
  expect(result).toMatchObject({
    success: true,
    value: { ballot: 'codeMatchesCurrentRecord', timestamp: 'notProvided' },
  });
});

it('rejects altered bytes including a leading UTF-8 BOM or invalid UTF-8', async () => {
  for (const file of [
    new File(['\uFEFF' + evidence.receipt], 'receipt.json'),
    new File([Uint8Array.from([255])], 'receipt.json'),
  ]) {
    const result = await checkLocalBallot({
      bundle: evidence.bundle,
      proof: null,
      input: { kind: 'receipt', file },
      labelsFile: null,
    });
    expect(result.success).toBe(false);
  }
});
