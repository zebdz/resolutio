import { describe, it, expect } from 'vitest';
import {
  DistributionType,
  parseDistributionType,
  isOwnershipMode,
} from '../DistributionType';

describe('DistributionType', () => {
  it('has three values', () => {
    expect(DistributionType.EQUAL).toBe('EQUAL');
    expect(DistributionType.OWNERSHIP_UNIT_COUNT).toBe('OWNERSHIP_UNIT_COUNT');
    expect(DistributionType.OWNERSHIP_SIZE_WEIGHTED).toBe(
      'OWNERSHIP_SIZE_WEIGHTED'
    );
  });

  describe('parseDistributionType', () => {
    it.each(['EQUAL', 'OWNERSHIP_UNIT_COUNT', 'OWNERSHIP_SIZE_WEIGHTED'])(
      'accepts %s',
      (v) => {
        const result = parseDistributionType(v);
        expect(result.success).toBe(true);
      }
    );

    it('rejects unknown values', () => {
      const result = parseDistributionType('SOMETHING_ELSE');
      expect(result.success).toBe(false);
    });

    it('rejects empty string', () => {
      const result = parseDistributionType('');
      expect(result.success).toBe(false);
    });
  });

  describe('isOwnershipMode', () => {
    it('is false for EQUAL', () => {
      expect(isOwnershipMode(DistributionType.EQUAL)).toBe(false);
    });
    it('is true for OWNERSHIP_UNIT_COUNT', () => {
      expect(isOwnershipMode(DistributionType.OWNERSHIP_UNIT_COUNT)).toBe(true);
    });
    it('is true for OWNERSHIP_SIZE_WEIGHTED', () => {
      expect(isOwnershipMode(DistributionType.OWNERSHIP_SIZE_WEIGHTED)).toBe(
        true
      );
    });
  });
});
