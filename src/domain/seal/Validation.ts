/** Small format guards shared by commitment builders and strict decoders. */
import { requireSeal, SealDomainCodes } from './SealDomainCodes';

export function exactKeys(
  value: unknown,
  keys: readonly string[]
): asserts value is Record<string, unknown> {
  requireSeal(
    value !== null && typeof value === 'object' && !Array.isArray(value)
  );
  const actual = Object.keys(value);
  requireSeal(
    actual.length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key))
  );
}

export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function assertV1(value: unknown): void {
  requireSeal(
    value !== null && typeof value === 'object' && !Array.isArray(value)
  );
  requireSeal(
    'version' in value && value.version === 1,
    SealDomainCodes.SEAL_VERSION_UNSUPPORTED
  );
  requireSeal(
    'algorithm' in value && value.algorithm === 'sha256',
    SealDomainCodes.SEAL_ALGORITHM_UNSUPPORTED
  );
}
