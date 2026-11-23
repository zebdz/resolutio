/** House and flat references retain the FIAS GUID representation without normalization.
 * Both schemas reject malformed registry identifiers at construction and rehydration boundaries. */
import { describe, expect, it } from 'vitest';
import { HouseFiasId, FlatFiasId } from '../AddressValues';

describe.each(Object.entries({ HouseFiasId, FlatFiasId }))(
  '%s',
  (_name, identity) => {
    it('preserves valid registry GUIDs', () => {
      for (const value of [
        'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        '9D9D7E0A-E49F-4EBF-A962-00CFA892B1EE',
      ]) {
        expect(identity.parse(value)).toBe(value);
      }
    });

    it('rejects malformed registry references', () => {
      for (const value of [
        '',
        'flat-id',
        '12345',
        'c1bfc52fe9a74d67a1bdb418f495d3f5',
        'g1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5 ',
        'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5\n',
        null,
        42,
      ]) {
        expect(identity.safeParse(value).success, String(value)).toBe(false);
      }
    });
  }
);
