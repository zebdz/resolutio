/** Persistence failures are validated opaque codes, independent of provider
 * failures and without prescribing operational variants before adapters exist. */
import { describe, expect, it } from 'vitest';
import { SealPersistenceFailureCode } from '../SealPersistenceFailureCode';

describe('seal persistence failure code', () => {
  it('retains a nonempty code and rejects absent or empty values', () => {
    expect(
      SealPersistenceFailureCode.parse('seal.errors.storageUnavailable')
    ).toBe('seal.errors.storageUnavailable');

    for (const value of ['', null, undefined, 42]) {
      expect(() => SealPersistenceFailureCode.parse(value)).toThrow();
    }
  });
});
