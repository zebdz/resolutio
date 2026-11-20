/** Reads voter-selected files entirely in this browser. Preserve every UTF-8 byte,
 * including a leading BOM, so hosted and offline checks reject the same alterations. */
import { verifyVoteEvidence } from '@/domain/seal/VerifyEvidence';
import { success, failure } from '@/domain/shared/Result';
import { SealDomainCodes } from '@/domain/seal/SealDomainCodes';

type BallotInput =
  | { kind: 'receipt'; file: File }
  | { kind: 'current'; code?: string };

async function readFile(file: File | null) {
  if (!file) {
    return success(undefined);
  }

  try {
    const bytes = await file.arrayBuffer();
    const text = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);

    return success(text);
  } catch {
    return failure('sealPrivate.fileUnreadable' as const);
  }
}

export async function checkLocalBallot({
  bundle,
  proof,
  input,
  labelsFile,
}: {
  bundle: string;
  proof: readonly number[] | null;
  input: BallotInput;
  labelsFile: File | null;
}) {
  const [receipt, labels] = await Promise.all([
    readFile(input.kind === 'receipt' ? input.file : null),
    readFile(labelsFile),
  ]);

  if (!receipt.success) {
    return receipt;
  }

  if (!labels.success) {
    return labels;
  }

  let sections: string | undefined;
  let poll: string | undefined;

  if (labels.value !== undefined) {
    // A retained download is an envelope; an extracted poll section is standalone.
    try {
      const doc: unknown = JSON.parse(labels.value);

      if (doc && typeof doc === 'object' && 'sections' in doc) {
        sections = labels.value;
      } else {
        poll = labels.value;
      }
    } catch {
      return failure(SealDomainCodes.SEAL_INVALID_CANONICAL);
    }
  }

  return verifyVoteEvidence({
    bundle,
    proof: proof ? Uint8Array.from(proof) : undefined,
    receipt: receipt.value,
    code: input.kind === 'current' ? input.code : undefined,
    poll,
    sections,
  });
}
