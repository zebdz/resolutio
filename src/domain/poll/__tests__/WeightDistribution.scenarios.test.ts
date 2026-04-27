// Narrative scenario tests for computeWeights.
//
// These tests are intentionally verbose and self-explanatory: each `it` block
// tells the story of Alice, Bob, Helen and their properties, then asserts the
// exact weights each configuration should produce. The goal is to FREEZE the
// current semantics so later refactors can't silently change behavior.
//
// Characters:
//   Alice, Bob, Helen — org members, possibly owning apartments and/or parking.
// Orgs (for cross-tree scenarios):
//   A = parent org, B = child 1 (apartments), C = child 2 (parking).
// Properties:
//   aptHouse (10 apts summing to 850m²) — owned rows in "B" for cross-tree tests
//   parkingLot (20 spots of 12m² each = 240m²) — owned rows in "C"

import { describe, it, expect } from 'vitest';
import { computeWeights, WeightDistributionInput } from '../WeightDistribution';
import { DistributionType } from '../DistributionType';
import { PropertyAggregation } from '../PropertyAggregation';

const ALICE = 'alice';
const BOB = 'bob';
const HELEN = 'helen';

const APT_HOUSE = 'prop-apt-house';
const PARKING_LOT = 'prop-parking-lot';

// 10 apts summing to 850m²
const aptSizes = [75, 100, 80, 80, 80, 85, 85, 85, 90, 90];
const apts = aptSizes.map((size, i) => ({
  id: `apt-${i + 1}`,
  propertyId: APT_HOUSE,
  size,
}));

// 20 parking spots of 12m² each
const parkingSpots = Array.from({ length: 20 }, (_, i) => ({
  id: `spot-${i + 1}`,
  propertyId: PARKING_LOT,
  size: 12,
}));

function sole(assetId: string, userId: string) {
  return { assetId, userId, share: 1 };
}

function split(assetId: string, owners: { userId: string; share: number }[]) {
  return owners.map((o) => ({ assetId, userId: o.userId, share: o.share }));
}

describe('WeightDistribution — narrative scenarios', () => {
  describe('EQUAL mode', () => {
    it('with no scope, every candidate gets weight 1 regardless of ownership', () => {
      const input: WeightDistributionInput = {
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.EQUAL,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [],
        assets: apts,
        ownerships: [sole('apt-1', ALICE)], // only Alice owns, doesn't matter
      };
      const weights = computeWeights(input);
      expect(weights.get(ALICE)).toBe(1);
      expect(weights.get(BOB)).toBe(1);
      expect(weights.get(HELEN)).toBe(1);
    });

    it('with explicit scope, only owners in the scope get weight 1', () => {
      const input: WeightDistributionInput = {
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.EQUAL,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE], // apt house in scope, parking excluded
        assets: apts,
        ownerships: [sole('apt-1', ALICE), sole('apt-2', BOB)],
        // Helen owns nothing → excluded
      };
      const weights = computeWeights(input);
      expect(weights.get(ALICE)).toBe(1);
      expect(weights.get(BOB)).toBe(1);
      expect(weights.has(HELEN)).toBe(false);
    });
  });

  describe('OWNERSHIP_SIZE_WEIGHTED — single property', () => {
    // Alice owns Apt #1 (75m²), Bob owns Apt #2 (100m²), Helen owns Apt #3 (80m²).
    const ownerships = [
      sole('apt-1', ALICE),
      sole('apt-2', BOB),
      sole('apt-3', HELEN),
    ];

    it('RAW_SUM: weight equals sum of owned areas', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(75);
      expect(weights.get(BOB)).toBe(100);
      expect(weights.get(HELEN)).toBe(80);
    });

    it('NORMALIZE_PER_PROPERTY: weight equals share of the total property area', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships,
      });
      // Total apt house area = 850m². Per-property normalization: size / 850.
      expect(weights.get(ALICE)).toBeCloseTo(75 / 850, 10);
      expect(weights.get(BOB)).toBeCloseTo(100 / 850, 10);
      expect(weights.get(HELEN)).toBeCloseTo(80 / 850, 10);
    });
  });

  describe('OWNERSHIP_SIZE_WEIGHTED — co-ownership', () => {
    // Alice and Bob each own 50% of Apt #1 (100m²). Helen solely owns Apt #2 (50m²).
    const aptsForCoOwnership = [
      { id: 'apt-1', propertyId: APT_HOUSE, size: 100 },
      { id: 'apt-2', propertyId: APT_HOUSE, size: 50 },
    ];
    const ownerships = [
      ...split('apt-1', [
        { userId: ALICE, share: 0.5 },
        { userId: BOB, share: 0.5 },
      ]),
      sole('apt-2', HELEN),
    ];

    it('co-owners split the asset contribution (no double counting)', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: aptsForCoOwnership,
        ownerships,
      });
      // Alice gets 50% of 100m² = 50, Bob same = 50, Helen full 50.
      expect(weights.get(ALICE)).toBe(50);
      expect(weights.get(BOB)).toBe(50);
      expect(weights.get(HELEN)).toBe(50);
    });
  });

  describe('OWNERSHIP_UNIT_COUNT — single property', () => {
    // Alice owns 1 apt, Bob owns 2 apts, Helen owns 3 apts.
    const ownerships = [
      sole('apt-1', ALICE),
      sole('apt-2', BOB),
      sole('apt-3', BOB),
      sole('apt-4', HELEN),
      sole('apt-5', HELEN),
      sole('apt-6', HELEN),
    ];

    it('RAW_SUM: weight equals count of owned apts', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(1);
      expect(weights.get(BOB)).toBe(2);
      expect(weights.get(HELEN)).toBe(3);
    });

    it('NORMALIZE_PER_PROPERTY: weight equals owned count / total count in property', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships,
      });
      // Total = 10 apts. Alice=1/10, Bob=2/10, Helen=3/10.
      expect(weights.get(ALICE)).toBeCloseTo(1 / 10, 10);
      expect(weights.get(BOB)).toBeCloseTo(2 / 10, 10);
      expect(weights.get(HELEN)).toBeCloseTo(3 / 10, 10);
    });
  });

  describe('OWNERSHIP_SIZE_WEIGHTED — mixed properties (the condo + parking case)', () => {
    // Alice owns Apt #1 (75m²) AND Parking #1 (12m²).
    // Bob owns Apt #2 (100m²) only (no parking).
    // Helen owns Parking #2 (12m²) only.
    const assets = [...apts, ...parkingSpots];
    const ownerships = [
      sole('apt-1', ALICE),
      sole('spot-1', ALICE),
      sole('apt-2', BOB),
      sole('spot-2', HELEN),
    ];

    it('RAW_SUM: apartment-sized properties dominate (unit-mixing problem)', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE, PARKING_LOT],
        assets,
        ownerships,
      });
      // Alice=75+12=87, Bob=100, Helen=12.
      expect(weights.get(ALICE)).toBe(87);
      expect(weights.get(BOB)).toBe(100);
      expect(weights.get(HELEN)).toBe(12);
    });

    it('NORMALIZE_PER_PROPERTY: each property contributes at most 1.0, fairness restored', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [APT_HOUSE, PARKING_LOT],
        assets,
        ownerships,
      });
      // Alice=75/850 + 12/240, Bob=100/850, Helen=12/240.
      expect(weights.get(ALICE)).toBeCloseTo(75 / 850 + 12 / 240, 10);
      expect(weights.get(BOB)).toBeCloseTo(100 / 850, 10);
      expect(weights.get(HELEN)).toBeCloseTo(12 / 240, 10);
    });
  });

  describe('OWNERSHIP_UNIT_COUNT — mixed properties', () => {
    // Alice owns 1 apt + 2 parking spots. Bob owns 1 apt. Helen owns 3 parking spots.
    const assets = [...apts, ...parkingSpots];
    const ownerships = [
      sole('apt-1', ALICE),
      sole('spot-1', ALICE),
      sole('spot-2', ALICE),
      sole('apt-2', BOB),
      sole('spot-3', HELEN),
      sole('spot-4', HELEN),
      sole('spot-5', HELEN),
    ];

    it('RAW_SUM: weight equals total owned-asset count across properties', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE, PARKING_LOT],
        assets,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(3); // 1+2
      expect(weights.get(BOB)).toBe(1);
      expect(weights.get(HELEN)).toBe(3);
    });

    it('NORMALIZE_PER_PROPERTY: per-property fractions sum across properties', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN],
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [APT_HOUSE, PARKING_LOT],
        assets,
        ownerships,
      });
      // Total apts=10, Total spots=20.
      // Alice = 1/10 + 2/20 = 0.1 + 0.1 = 0.2
      // Bob   = 1/10 = 0.1
      // Helen = 3/20 = 0.15
      expect(weights.get(ALICE)).toBeCloseTo(0.2, 10);
      expect(weights.get(BOB)).toBeCloseTo(0.1, 10);
      expect(weights.get(HELEN)).toBeCloseTo(0.15, 10);
    });
  });

  describe('Scope filter', () => {
    // Alice owns Apt #1 AND Parking #1. Scoping poll to apts-only should exclude her parking.
    const assets = [...apts, ...parkingSpots];
    const ownerships = [sole('apt-1', ALICE), sole('spot-1', ALICE)];

    it('SIZE_WEIGHTED RAW_SUM scoped to apartments only: parking excluded', () => {
      const weights = computeWeights({
        candidates: [ALICE],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(75); // apt only, no 12 from parking
    });

    it('UNIT_COUNT RAW_SUM scoped to parking only: apts excluded', () => {
      const weights = computeWeights({
        candidates: [ALICE],
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [PARKING_LOT],
        assets,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(1); // one spot only
    });
  });

  describe('Non-participant owner dilution (NORMALIZE_PER_PROPERTY)', () => {
    // All 10 apts are owned, but only 3 of the owners are in candidates.
    // Non-candidate owners still dilute normalized weights.
    it('non-candidate owners lower the per-property fraction', () => {
      const ownerships = apts.map((a, i) => {
        // Alice owns apt-1, Bob owns apt-2, Helen owns apt-3, rest by unknowns.
        const owner =
          i === 0 ? ALICE : i === 1 ? BOB : i === 2 ? HELEN : `other-${i}`;

        return sole(a.id, owner);
      });
      const weights = computeWeights({
        candidates: [ALICE, BOB, HELEN], // only our 3 vote
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships,
      });
      // Denominator includes ALL apts (850m²), not just candidates'.
      expect(weights.get(ALICE)).toBeCloseTo(75 / 850, 10);
      expect(weights.get(BOB)).toBeCloseTo(100 / 850, 10);
      expect(weights.get(HELEN)).toBeCloseTo(80 / 850, 10);
    });
  });

  describe('Cross-tree ownership (assets in descendant orgs)', () => {
    // Setup: Org A (parent) has a poll. B and C are children.
    //   apt-1 in property APT_HOUSE (owned by B)
    //   spot-1 in property PARKING_LOT (owned by C)
    // computeWeights is org-agnostic — it only sees assets + ownership, not orgs.
    // As long as the CALLER fed it the tree-aware ownership set, weights are correct.
    const assets = [
      { id: 'apt-1', propertyId: APT_HOUSE, size: 75 },
      { id: 'spot-1', propertyId: PARKING_LOT, size: 12 },
    ];
    const ownerships = [sole('apt-1', ALICE), sole('spot-1', ALICE)];

    it('SIZE_WEIGHTED RAW_SUM: Alice sums her B-apt and C-parking contributions', () => {
      const weights = computeWeights({
        candidates: [ALICE],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE, PARKING_LOT],
        assets,
        ownerships,
      });
      expect(weights.get(ALICE)).toBe(75 + 12);
    });
  });

  describe('Multi-tree membership safety', () => {
    // Alice is a member of BOTH B and C (allowMultiTreeMembership=true at tree root).
    // Her ownership rows exist once per (asset, user) — schema-enforced at asset level.
    // Candidates are deduped at the repo layer (Set). computeWeights MUST NOT double-count
    // Alice's contribution even if — hypothetically — she appeared twice in candidates.

    it('if candidates list contains a duplicate, weight is still single-counted', () => {
      const weights = computeWeights({
        candidates: [ALICE, ALICE, BOB], // Alice listed twice (defensive test)
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships: [sole('apt-1', ALICE), sole('apt-2', BOB)],
      });
      // computeWeights uses a Map keyed by userId — second assignment overwrites first with same value.
      expect(weights.get(ALICE)).toBe(75);
      expect(weights.get(BOB)).toBe(100);
    });

    it('duplicate ownership rows for the same (asset, user) would double-count; repo must guarantee uniqueness', () => {
      // This test documents that computeWeights does NOT dedup ownership rows.
      // The ROW UNIQUENESS invariant lives in the repository/DB (effective window + asset-level sum=1).
      const weights = computeWeights({
        candidates: [ALICE],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships: [sole('apt-1', ALICE), sole('apt-1', ALICE)], // malformed input
      });
      // Documented behavior: doubled. This is why the repository must never return duplicates.
      expect(weights.get(ALICE)).toBe(150);
    });
  });

  describe('Ownership modes exclude non-owning candidates', () => {
    it('a candidate with zero ownership in scope is omitted from the weight map', () => {
      const weights = computeWeights({
        candidates: [ALICE, BOB],
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [APT_HOUSE],
        assets: apts,
        ownerships: [sole('apt-1', ALICE)], // Bob owns nothing
      });
      expect(weights.get(ALICE)).toBe(75);
      expect(weights.has(BOB)).toBe(false);
    });
  });
});
