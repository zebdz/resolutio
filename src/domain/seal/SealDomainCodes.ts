/** Stable, translatable failures from the seal bounded context. */
import { failure, Result, success } from '../shared/Result';

export const SealDomainCodes = {
  SEAL_POLL_NOT_FINISHED: 'domain.seal.pollNotFinished',
  SEAL_INCONSISTENT_RECORD: 'domain.seal.inconsistentRecord',
  SEAL_MISSING_RECEIPT_SECRET: 'domain.seal.missingReceiptSecret',
  SEAL_ANCHOR_ILLEGAL_TRANSITION: 'domain.seal.anchorIllegalTransition',
  SEAL_VERSION_UNSUPPORTED: 'domain.seal.versionUnsupported',
  SEAL_ALGORITHM_UNSUPPORTED: 'domain.seal.algorithmUnsupported',
  SEAL_LEAF_NOT_FOUND: 'domain.seal.leafNotFound',
  SEAL_INVALID_WEIGHT: 'domain.seal.invalidWeight',
  SEAL_INVALID_CANONICAL: 'domain.seal.invalidCanonical',
  SEAL_INVALID_PROOF: 'domain.seal.invalidProof',
} as const;

export type SealDomainCode =
  (typeof SealDomainCodes)[keyof typeof SealDomainCodes];

export class SealError extends Error {
  constructor(readonly code: SealDomainCode) {
    super(code);
  }
}

/** Turn validation failures into results at aggregate/factory boundaries. */
export function sealResult<T>(build: () => T): Result<T, SealDomainCode> {
  try {
    return success(build());
  } catch (error) {
    if (error instanceof SealError) {
      return failure(error.code);
    }

    throw error;
  }
}

export function requireSeal(
  condition: unknown,
  code: SealDomainCode = SealDomainCodes.SEAL_INCONSISTENT_RECORD
): asserts condition {
  if (!condition) {
    throw new SealError(code);
  }
}
