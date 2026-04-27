import { describe, it, expect } from 'vitest';
import {
  PropertyAggregation,
  parsePropertyAggregation,
} from '../PropertyAggregation';

describe('PropertyAggregation', () => {
  it('has two values', () => {
    expect(PropertyAggregation.RAW_SUM).toBe('RAW_SUM');
    expect(PropertyAggregation.NORMALIZE_PER_PROPERTY).toBe(
      'NORMALIZE_PER_PROPERTY'
    );
  });

  describe('parsePropertyAggregation', () => {
    it.each(['RAW_SUM', 'NORMALIZE_PER_PROPERTY'])('accepts %s', (v) => {
      const result = parsePropertyAggregation(v);
      expect(result.success).toBe(true);
    });

    it('rejects unknown values', () => {
      const result = parsePropertyAggregation('ROOT_MEAN_SQUARE');
      expect(result.success).toBe(false);
    });
  });
});
