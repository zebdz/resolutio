/** Arithmetic examples preserve ownership totals across distribution modes. */
import { z } from 'zod';
import { UserId } from '../../shared/EntityIds';
import { describe, it, expect } from 'vitest';
import { computeWeights, WeightDistributionInput } from '../WeightDistribution';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

function weights(input: z.input<typeof WeightDistributionInput>) {
  const result = computeWeights(WeightDistributionInput.parse(input));

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value;
}

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
    const input: z.input<typeof WeightDistributionInput> = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [],
      ownerships: [],
    };
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBe(1.0);
    expect(out.get(UserId.parse('bob'))).toBe(1.0);
  });

  it('scope: candidate eligible iff they own ≥1 in-scope asset', () => {
    const input: z.input<typeof WeightDistributionInput> = {
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
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBe(1.0);
    expect(out.has(UserId.parse('bob'))).toBe(false);
    expect(out.has(UserId.parse('carol'))).toBe(false);
  });
});

describe('computeWeights — OWNERSHIP_UNIT_COUNT × RAW_SUM', () => {
  it('sums shares across assets; size ignored', () => {
    const input: z.input<typeof WeightDistributionInput> = {
      candidates: ['alice'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 75), asset('a2', 'P1', 100)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'alice', 0.5)],
    };
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBeCloseTo(1.5, 6);
  });

  it('filters out zero-weight users', () => {
    const input: z.input<typeof WeightDistributionInput> = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 10)],
      ownerships: [own('a1', 'alice', 1)],
    };
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBe(1);
    expect(out.has(UserId.parse('bob'))).toBe(false);
  });

  it('co-ownership: each owner gets fractional share, no double-count', () => {
    const input: z.input<typeof WeightDistributionInput> = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100)],
      ownerships: [own('a1', 'alice', 0.5), own('a1', 'bob', 0.5)],
    };
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBeCloseTo(0.5, 6);
    expect(out.get(UserId.parse('bob'))).toBeCloseTo(0.5, 6);
  });
});

describe('computeWeights — OWNERSHIP_SIZE_WEIGHTED × RAW_SUM', () => {
  it('uses asset.size as effective_size', () => {
    const input: z.input<typeof WeightDistributionInput> = {
      candidates: ['alice', 'bob'],
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      assets: [asset('a1', 'P1', 100), asset('a2', 'P1', 50)],
      ownerships: [own('a1', 'alice', 1), own('a2', 'bob', 1)],
    };
    const out = weights(input);
    expect(out.get(UserId.parse('alice'))).toBeCloseTo(100, 6);
    expect(out.get(UserId.parse('bob'))).toBeCloseTo(50, 6);
  });
});

describe('computeWeights — NORMALIZE_PER_PROPERTY', () => {
  it('Alice example — SIZE_WEIGHTED across 2 properties', () => {
    const apt = (id: string, size: number) => asset(id, 'P1', size);
    const park = (id: string, size: number) => asset(id, 'P2', size);
    const input: z.input<typeof WeightDistributionInput> = {
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
    const w = weights(input).get(UserId.parse('alice'))!;
    // Apt: (75 + 50) / 850 ≈ 0.147058
    // Parking: (12 + 12 + 6) / 240 = 0.125
    // Sum ≈ 0.272058
    expect(w).toBeCloseTo(0.272058, 5);
  });

  it('NORMALIZE UNIT_COUNT: 2 of 4 apts → 0.5', () => {
    const input: z.input<typeof WeightDistributionInput> = {
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
    const w = weights(input).get(UserId.parse('alice'))!;
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
    const raw = weights({
      ...common,
      propertyAggregation: PropertyAggregation.RAW_SUM,
    });
    const norm = weights({
      ...common,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
    });
    expect(raw.get(UserId.parse('a'))! > raw.get(UserId.parse('b'))!).toBe(
      true
    );
    expect(raw.get(UserId.parse('b'))! > raw.get(UserId.parse('c'))!).toBe(
      true
    );
    expect(norm.get(UserId.parse('a'))! > norm.get(UserId.parse('b'))!).toBe(
      true
    );
    expect(norm.get(UserId.parse('b'))! > norm.get(UserId.parse('c'))!).toBe(
      true
    );
    expect(
      norm.get(UserId.parse('a'))! / raw.get(UserId.parse('a'))!
    ).toBeCloseTo(
      norm.get(UserId.parse('b'))! / raw.get(UserId.parse('b'))!,
      6
    );
  });
});
