import { describe, it, expect } from 'vitest';
import { computeWeights, WeightDistributionInput } from '../WeightDistribution';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

// Mini helpers so tests read like specs.
const asset = (id: string, propertyId: string, size: number) => ({
  id,
  propertyId,
  size,
});
const own = (assetId: string, userId: string, share: number) => ({
  assetId,
  userId,
  share,
});

describe('computeWeights — EQUAL', () => {
  it('no scope: every candidate gets weight 1.0', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [],
      ownerships: [],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1.0);
    expect(out.get('bob')).toBe(1.0);
  });

  it('scope: candidate eligible iff they own ≥1 in-scope asset', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob', 'carol'],
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['P1'],
      assets: [asset('a1', 'P1', 10), asset('a2', 'P2', 20)],
      ownerships: [
        own('a1', 'alice', 1), // in scope
        own('a2', 'bob', 1), // out of scope
        // carol owns nothing
      ],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1.0);
    expect(out.has('bob')).toBe(false);
    expect(out.has('carol')).toBe(false);
  });
});

describe('computeWeights — OWNERSHIP_UNIT_COUNT × RAW_SUM', () => {
  it('sums shares across assets; size ignored', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 75), asset('a2', 'P1', 100)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'alice', 0.5)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(1.5, 6);
  });

  it('filters out zero-weight users', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 10)],
      ownerships: [own('a1', 'alice', 1)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBe(1);
    expect(out.has('bob')).toBe(false);
  });

  it('co-ownership: each owner gets fractional share, no double-count', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100)],
      ownerships: [own('a1', 'alice', 0.5), own('a1', 'bob', 0.5)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(0.5, 6);
    expect(out.get('bob')).toBeCloseTo(0.5, 6);
  });
});

describe('computeWeights — OWNERSHIP_SIZE_WEIGHTED × RAW_SUM', () => {
  it('uses asset.size as effective_size', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100), asset('a2', 'P1', 50)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'bob', 1)],
    };
    const out = computeWeights(input);
    expect(out.get('alice')).toBeCloseTo(100, 6);
    expect(out.get('bob')).toBeCloseTo(50, 6);
  });
});

describe('computeWeights — NORMALIZE_PER_PROPERTY', () => {
  it('Alice example — SIZE_WEIGHTED across 2 properties', () => {
    const apt = (id: string, size: number) => asset(id, 'P1', size);
    const park = (id: string, size: number) => asset(id, 'P2', size);
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: ['P1', 'P2'],
      assets: [
        apt('a1', 75),
        apt('a2', 100),
        apt('aR1', 80),
        apt('aR2', 80),
        apt('aR3', 80),
        apt('aR4', 85),
        apt('aR5', 85),
        apt('aR6', 85),
        apt('aR7', 90),
        apt('aR8', 90),
        // parking: 20 x 12 = 240
        park('p1', 12),
        park('p2', 12),
        park('p3', 12),
        park('p4', 12),
        park('p5', 12),
        park('p6', 12),
        park('p7', 12),
        park('p8', 12),
        park('p9', 12),
        park('p10', 12),
        park('p11', 12),
        park('p12', 12),
        park('p13', 12),
        park('p14', 12),
        park('p15', 12),
        park('p16', 12),
        park('p17', 12),
        park('p18', 12),
        park('p19', 12),
        park('p20', 12),
      ],
      ownerships: [
        own('a1', 'alice', 1),
        own('a2', 'alice', 0.5),
        own('p1', 'alice', 1),
        own('p2', 'alice', 1),
        own('p3', 'alice', 0.5),
      ],
    };
    const w = computeWeights(input).get('alice')!;
    // Apt: (75 + 50) / 850 ≈ 0.147058
    // Parking: (12 + 12 + 6) / 240 = 0.125
    // Sum ≈ 0.272058
    expect(w).toBeCloseTo(0.272058, 5);
  });

  it('NORMALIZE UNIT_COUNT: 2 of 4 apts → 0.5', () => {
    const input: WeightDistributionInput = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: ['P1'],
      assets: [
        asset('a1', 'P1', 10),
        asset('a2', 'P1', 10),
        asset('a3', 'P1', 10),
        asset('a4', 'P1', 10),
      ],
      ownerships: [own('a1', 'alice', 1), own('a2', 'alice', 1)],
    };
    const w = computeWeights(input).get('alice')!;
    expect(w).toBeCloseTo(0.5, 6);
  });

  it('Single-property scope: both aggregations yield proportional rankings', () => {
    const common = {
      candidates: ['a', 'b', 'c'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyIds: ['P'],
      assets: [
        asset('x1', 'P', 100),
        asset('x2', 'P', 50),
        asset('x3', 'P', 25),
      ],
      ownerships: [own('x1', 'a', 1), own('x2', 'b', 1), own('x3', 'c', 1)],
    };
    const raw = computeWeights({
      ...common,
      propertyAggregation: PropertyAggregation.RAW_SUM,
    });
    const norm = computeWeights({
      ...common,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
    });
    expect(raw.get('a')! > raw.get('b')!).toBe(true);
    expect(raw.get('b')! > raw.get('c')!).toBe(true);
    expect(norm.get('a')! > norm.get('b')!).toBe(true);
    expect(norm.get('b')! > norm.get('c')!).toBe(true);
    expect(norm.get('a')! / raw.get('a')!).toBeCloseTo(
      norm.get('b')! / raw.get('b')!,
      6
    );
  });
});
