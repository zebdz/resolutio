import { describe, it, expect } from 'vitest';
import { SizeUnit, SizeUnitValue } from '../SizeUnit';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('SizeUnit', () => {
  it('enumerates all supported units', () => {
    expect(SizeUnit.values).toEqual([
      'SQUARE_METERS',
      'SQUARE_FEET',
      'HECTARES',
      'ACRES',
      'CUBIC_METERS',
      'LINEAR_METERS',
      'UNIT_COUNT',
      'SHARES',
    ]);
  });

  describe('parse', () => {
    it('accepts every valid value', () => {
      for (const v of SizeUnit.values) {
        const r = SizeUnit.parse(v);
        expect(r.success).toBe(true);

        if (r.success) {
          expect(r.value).toBe(v);
        }
      }
    });

    it('rejects unknown value', () => {
      const r = SizeUnit.parse('FURLONGS');
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
      }
    });

    it('rejects empty string', () => {
      const r = SizeUnit.parse('');
      expect(r.success).toBe(false);
    });
  });

  describe('translationKey', () => {
    it('maps to camelCase key under propertyAdmin.sizeUnit', () => {
      expect(SizeUnit.translationKey('SQUARE_METERS')).toBe(
        'propertyAdmin.sizeUnit.squareMeters'
      );
      expect(SizeUnit.translationKey('UNIT_COUNT')).toBe(
        'propertyAdmin.sizeUnit.unitCount'
      );
      expect(SizeUnit.translationKey('LINEAR_METERS')).toBe(
        'propertyAdmin.sizeUnit.linearMeters'
      );
    });
  });
});
