import { describe, it, expect } from 'vitest';
import { PollWeightConfig } from '../PollWeightConfig';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

describe('PollWeightConfig', () => {
  const makeBase = () =>
    PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
    });

  it('stores fields', () => {
    const base = makeBase();
    expect(base.distributionType).toBe(DistributionType.EQUAL);
    expect(base.propertyAggregation).toBe(PropertyAggregation.RAW_SUM);
    expect(base.propertyIds).toEqual([]);
  });

  it('equals another config with the same fields', () => {
    const a = makeBase();
    const b = makeBase();
    expect(a.equals(b)).toBe(true);
  });

  it('is not equal when distributionType differs', () => {
    const a = makeBase();
    const b = PollWeightConfig.create({
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
    });
    expect(a.equals(b)).toBe(false);
  });

  it('is not equal when propertyAggregation differs', () => {
    const a = makeBase();
    const b = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: [],
    });
    expect(a.equals(b)).toBe(false);
  });

  it('treats propertyIds as order-insensitive', () => {
    const a = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['a', 'b'],
    });
    const b = PollWeightConfig.create({
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['b', 'a'],
    });
    expect(a.equals(b)).toBe(true);
  });

  describe('merge', () => {
    it('overrides only supplied fields', () => {
      const merged = makeBase().merge({
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      });
      expect(merged.distributionType).toBe(
        DistributionType.OWNERSHIP_UNIT_COUNT
      );
      expect(merged.propertyAggregation).toBe(PropertyAggregation.RAW_SUM);
      expect(merged.propertyIds).toEqual([]);
    });

    it('leaves base untouched', () => {
      const base = makeBase();
      base.merge({ distributionType: DistributionType.OWNERSHIP_UNIT_COUNT });
      expect(base.distributionType).toBe(DistributionType.EQUAL);
    });
  });
});
