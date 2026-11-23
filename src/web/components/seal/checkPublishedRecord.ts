/** Read optional evidence in the browser and compare its exact bytes with the displayed public manifest.
 * Saved section files never enter a request; the server reauthorizes each protected download. */
import { verifyEvidence } from '@/domain/seal/VerifyEvidence';
import { failure, success } from '@/domain/shared/Result';

export interface PublishedRecordCheck {
  readonly pollId: string;
  readonly manifest: string;
  readonly rootDigest: string;
  readonly hasProof: boolean;
  readonly canReadSections: boolean;
}

type Download = (url: string, options: RequestInit) => Promise<Response>;

async function download(url: string, get: Download) {
  try {
    const response = await get(url, { cache: 'no-store' });

    return response.ok
      ? success(await response.arrayBuffer())
      : failure('sealPublic.downloadUnavailable' as const);
  } catch {
    return failure('sealPublic.downloadUnavailable' as const);
  }
}

async function sectionBytes(file: File) {
  try {
    return success(await file.arrayBuffer());
  } catch {
    return failure('sealPublic.readError' as const);
  }
}

export async function checkPublishedRecord(
  record: PublishedRecordCheck,
  file?: File,
  get: Download = fetch
) {
  const base = '/api/polls/' + encodeURIComponent(record.pollId) + '/seal/';
  const [sections, proof] = await Promise.all([
    file
      ? sectionBytes(file)
      : record.canReadSections
        ? download(base + 'sections', get)
        : success(undefined),
    record.hasProof ? download(base + 'proof', get) : success(undefined),
  ]);

  if (!sections.success) {
    return sections;
  }

  if (!proof.success) {
    return proof;
  }

  let text: string | undefined;

  if (sections.value !== undefined) {
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        sections.value
      );
    } catch {
      return failure('domain.seal.invalidCanonical' as const);
    }
  }

  const result = verifyEvidence({
    manifest: record.manifest,
    sections: text,
    proof: proof.value === undefined ? undefined : new Uint8Array(proof.value),
  });

  if (
    result.success &&
    (result.value.pollId !== record.pollId ||
      result.value.rootDigest !== record.rootDigest)
  ) {
    return failure('domain.seal.manifestMismatch' as const);
  }

  return result;
}
