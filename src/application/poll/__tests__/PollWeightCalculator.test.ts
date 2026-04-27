import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PollWeightCalculator } from '../PollWeightCalculator';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { PropertyAssetRepository } from '../../../domain/organization/PropertyAssetRepository';
import { DistributionType } from '../../../domain/poll/DistributionType';
import { PropertyAggregation } from '../../../domain/poll/PropertyAggregation';
import { success, failure } from '../../../domain/shared/Result';

describe('PollWeightCalculator', () => {
  let organizationRepository: Partial<OrganizationRepository>;
  let propertyAssetRepository: Partial<PropertyAssetRepository>;
  let calculator: PollWeightCalculator;

  beforeEach(() => {
    organizationRepository = {
      getDescendantIds: vi.fn().mockResolvedValue([]),
    };
    propertyAssetRepository = {
      findAssetsInScope: vi.fn().mockResolvedValue(success([])),
      findCurrentOwnership: vi.fn().mockResolvedValue(success([])),
    };
    calculator = new PollWeightCalculator(
      organizationRepository as OrganizationRepository,
      propertyAssetRepository as PropertyAssetRepository
    );
  });

  it('EQUAL with no scope: skips DB and returns weight 1 per candidate', async () => {
    const r = await calculator.compute({
      organizationId: 'org-1',
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      candidates: ['a', 'b', 'c'],
    });

    expect(r.success).toBe(true);

    if (!r.success) {
      return;
    }

    expect(r.value.get('a')).toBe(1);
    expect(r.value.get('b')).toBe(1);
    expect(r.value.get('c')).toBe(1);
    expect(propertyAssetRepository.findAssetsInScope).not.toHaveBeenCalled();
    expect(propertyAssetRepository.findCurrentOwnership).not.toHaveBeenCalled();
  });

  it('EQUAL with scope: uses ownership as eligibility filter', async () => {
    propertyAssetRepository.findAssetsInScope = vi
      .fn()
      .mockResolvedValue(
        success([{ id: 'asset-1', propertyId: 'P', size: 50 }])
      );
    propertyAssetRepository.findCurrentOwnership = vi.fn().mockResolvedValue(
      success([
        {
          asset: { id: 'asset-1', propertyId: 'P', size: 50 },
          ownership: { assetId: 'asset-1', userId: 'a', share: 1 },
        },
      ])
    );

    const r = await calculator.compute({
      organizationId: 'org-1',
      distributionType: DistributionType.EQUAL,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['P'],
      candidates: ['a', 'b'],
    });

    expect(r.success).toBe(true);

    if (!r.success) {
      return;
    }

    expect(r.value.get('a')).toBe(1);
    expect(r.value.has('b')).toBe(false);
  });

  // The reason this service exists: deriving the asset list from ownership
  // rows double-counts multi-owner assets and drops ownerless ones, both of
  // which corrupt the per-property denominator under NORMALIZE_PER_PROPERTY.
  it('SIZE_WEIGHTED + NORMALIZE: each asset counted once in denom (multi-owner) and ownerless assets dilute', async () => {
    // Property "P":
    //   shared 80 m² (Alice 50% + Bob 50%)
    //   solo   20 m² (Alice 100%)
    //   empty 100 m² (no owners)
    // Per-property denom = 80 + 20 + 100 = 200.
    propertyAssetRepository.findAssetsInScope = vi.fn().mockResolvedValue(
      success([
        { id: 'shared', propertyId: 'P', size: 80 },
        { id: 'solo', propertyId: 'P', size: 20 },
        { id: 'empty', propertyId: 'P', size: 100 },
      ])
    );
    propertyAssetRepository.findCurrentOwnership = vi.fn().mockResolvedValue(
      success([
        {
          asset: { id: 'shared', propertyId: 'P', size: 80 },
          ownership: { assetId: 'shared', userId: 'alice', share: 0.5 },
        },
        {
          asset: { id: 'shared', propertyId: 'P', size: 80 },
          ownership: { assetId: 'shared', userId: 'bob', share: 0.5 },
        },
        {
          asset: { id: 'solo', propertyId: 'P', size: 20 },
          ownership: { assetId: 'solo', userId: 'alice', share: 1 },
        },
      ])
    );

    const r = await calculator.compute({
      organizationId: 'org-1',
      distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
      propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
      propertyIds: [],
      candidates: ['alice', 'bob'],
    });

    expect(r.success).toBe(true);

    if (!r.success) {
      return;
    }

    // Alice: (0.5 × 80 + 1 × 20) / 200 = 60/200 = 0.30
    // Bob:   (0.5 × 80) / 200 = 40/200 = 0.20
    expect(r.value.get('alice')).toBeCloseTo(0.3, 6);
    expect(r.value.get('bob')).toBeCloseTo(0.2, 6);
  });

  it('walks descendants to build treeOrgIds before querying', async () => {
    organizationRepository.getDescendantIds = vi
      .fn()
      .mockResolvedValue(['child-1', 'child-2']);

    await calculator.compute({
      organizationId: 'root',
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: ['P'],
      candidates: [],
    });

    expect(propertyAssetRepository.findAssetsInScope).toHaveBeenCalledWith(
      ['root', 'child-1', 'child-2'],
      ['P']
    );
    expect(propertyAssetRepository.findCurrentOwnership).toHaveBeenCalledWith(
      ['root', 'child-1', 'child-2'],
      ['P']
    );
  });

  it('skips external-owner placeholder rows (userId = null)', async () => {
    propertyAssetRepository.findAssetsInScope = vi
      .fn()
      .mockResolvedValue(
        success([{ id: 'asset-1', propertyId: 'P', size: 100 }])
      );
    propertyAssetRepository.findCurrentOwnership = vi.fn().mockResolvedValue(
      success([
        {
          asset: { id: 'asset-1', propertyId: 'P', size: 100 },
          ownership: { assetId: 'asset-1', userId: null, share: 1 },
        },
      ])
    );

    const r = await calculator.compute({
      organizationId: 'org-1',
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      candidates: ['alice'],
    });

    expect(r.success).toBe(true);

    if (!r.success) {
      return;
    }

    // Alice has no row of her own, the only ownership belongs to an external
    // placeholder → no per-user weight for anyone in `candidates`.
    expect(r.value.size).toBe(0);
  });

  describe('computeBuildingTotal — theoretical-max denominator for "% of building"', () => {
    // Reflects the spec's "Building total voting power" — what Σ weights would
    // be if every existing owner row were a registered user AND every asset
    // were fully owned. Unregistered owners and ownerless assets contribute
    // their full theoretical share — that's the gap admins want to see.
    it('OWNERSHIP_SIZE_WEIGHTED + RAW_SUM: Σ of in-scope non-archived asset sizes', async () => {
      propertyAssetRepository.findAssetsInScope = vi.fn().mockResolvedValue(
        success([
          { id: 'a', propertyId: 'P', size: 80 },
          { id: 'b', propertyId: 'P', size: 20 },
          { id: 'c', propertyId: 'Q', size: 100 },
        ])
      );

      const r = await calculator.computeBuildingTotal({
        organizationId: 'org-1',
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [],
      });

      expect(r.success).toBe(true);

      if (!r.success) {
        return;
      }

      expect(r.value).toBe(200);
    });

    it('OWNERSHIP_UNIT_COUNT + RAW_SUM: count of in-scope non-archived assets', async () => {
      propertyAssetRepository.findAssetsInScope = vi.fn().mockResolvedValue(
        success([
          { id: 'a', propertyId: 'P', size: 80 },
          { id: 'b', propertyId: 'P', size: 20 },
          { id: 'c', propertyId: 'Q', size: 100 },
        ])
      );

      const r = await calculator.computeBuildingTotal({
        organizationId: 'org-1',
        distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
        propertyAggregation: PropertyAggregation.RAW_SUM,
        propertyIds: [],
      });

      expect(r.success).toBe(true);

      if (!r.success) {
        return;
      }

      expect(r.value).toBe(3);
    });

    it('NORMALIZE_PER_PROPERTY (either mode): count of distinct properties with ≥1 asset', async () => {
      // 3 assets across 2 properties — each property maxes at 1.0, so building = 2.
      propertyAssetRepository.findAssetsInScope = vi.fn().mockResolvedValue(
        success([
          { id: 'a', propertyId: 'P', size: 80 },
          { id: 'b', propertyId: 'P', size: 20 },
          { id: 'c', propertyId: 'Q', size: 100 },
        ])
      );

      const r = await calculator.computeBuildingTotal({
        organizationId: 'org-1',
        distributionType: DistributionType.OWNERSHIP_SIZE_WEIGHTED,
        propertyAggregation: PropertyAggregation.NORMALIZE_PER_PROPERTY,
        propertyIds: [],
      });

      expect(r.success).toBe(true);

      if (!r.success) {
        return;
      }

      expect(r.value).toBe(2);
    });
  });

  it('propagates findAssetsInScope failure', async () => {
    propertyAssetRepository.findAssetsInScope = vi
      .fn()
      .mockResolvedValue(failure('DB asset error'));

    const r = await calculator.compute({
      organizationId: 'org-1',
      distributionType: DistributionType.OWNERSHIP_UNIT_COUNT,
      propertyAggregation: PropertyAggregation.RAW_SUM,
      propertyIds: [],
      candidates: ['alice'],
    });

    expect(r.success).toBe(false);

    if (r.success) {
      return;
    }

    expect(r.error).toBe('DB asset error');
  });
});
