// Application service: builds the input for `computeWeights` from the
// repository layer and runs the math. Used by all three poll-flow use cases
// (TakeSnapshot, UpdatePollWeightConfig, PreviewPollWeightConfig) so that
// the read+compute logic exists in exactly one place — fixing the data-shape
// bug here fixes every call site at once.
//
// The two repository calls deliberately stay separate:
//   - findAssetsInScope returns each asset exactly once (drives the
//     per-property denominator under NORMALIZE_PER_PROPERTY)
//   - findCurrentOwnership returns one row per ownership (an asset with N
//     owners produces N rows)
// Deriving the asset list from ownership rows would either double-count
// multi-owner assets or drop ownerless ones — both break the math.

import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import {
  computeWeights,
  WeightAsset,
  WeightOwnership,
} from '../../domain/poll/WeightDistribution';
import {
  DistributionType,
  isOwnershipMode,
} from '../../domain/poll/DistributionType';
import { PropertyAggregation } from '../../domain/poll/PropertyAggregation';

export interface PollWeightCalculatorInput {
  organizationId: string;
  distributionType: DistributionType;
  propertyAggregation: PropertyAggregation;
  propertyIds: string[];
  candidates: string[];
}

export class PollWeightCalculator {
  constructor(
    private organizationRepository: OrganizationRepository,
    private propertyAssetRepository: PropertyAssetRepository
  ) {}

  async compute(
    input: PollWeightCalculatorInput
  ): Promise<Result<Map<string, number>, string>> {
    // EQUAL with a property scope still has to look at ownership (scope
    // doubles as an eligibility filter); EQUAL with no scope skips the DB.
    const needsOwnership =
      isOwnershipMode(input.distributionType) ||
      (input.distributionType === DistributionType.EQUAL &&
        input.propertyIds.length > 0);

    let assets: WeightAsset[] = [];
    let ownerships: WeightOwnership[] = [];

    if (needsOwnership) {
      // Tree-aware: a parent-org poll can scope assets owned through descendant orgs.
      const descendantIds = await this.organizationRepository.getDescendantIds(
        input.organizationId
      );
      const treeOrgIds = [input.organizationId, ...descendantIds];

      const [assetsResult, ownershipResult] = await Promise.all([
        this.propertyAssetRepository.findAssetsInScope(
          treeOrgIds,
          input.propertyIds
        ),
        this.propertyAssetRepository.findCurrentOwnership(
          treeOrgIds,
          input.propertyIds
        ),
      ]);

      if (!assetsResult.success) {
        return failure(assetsResult.error);
      }

      if (!ownershipResult.success) {
        return failure(ownershipResult.error);
      }

      assets = assetsResult.value.map((a) => ({
        id: a.id,
        propertyId: a.propertyId,
        size: a.size,
      }));
      // External-owner placeholder rows (userId = null) can't contribute to
      // per-user weights — skip them from the math.
      ownerships = ownershipResult.value
        .filter(
          (r): r is typeof r & { ownership: { userId: string } } =>
            r.ownership.userId !== null
        )
        .map((r) => ({
          assetId: r.ownership.assetId,
          userId: r.ownership.userId,
          share: r.ownership.share,
        }));
    }

    return success(
      computeWeights({
        candidates: input.candidates,
        distributionType: input.distributionType,
        propertyAggregation: input.propertyAggregation,
        propertyIds: input.propertyIds,
        assets,
        ownerships,
      })
    );
  }

  // "Building total" = theoretical max Σ weights if every owner were registered
  // AND every asset fully owned. Used as the denominator for "% of building"
  // displays so admins can see the registration gap (Registered vs Building).
  // Rules per spec table:
  //   UNIT_COUNT  + RAW_SUM    → count of in-scope assets
  //   SIZE        + RAW_SUM    → Σ in-scope asset sizes
  //   either      + NORMALIZE  → count of distinct in-scope properties
  //   EQUAL                    → not meaningful (caller should use registered)
  async computeBuildingTotal(input: {
    organizationId: string;
    distributionType: DistributionType;
    propertyAggregation: PropertyAggregation;
    propertyIds: string[];
  }): Promise<Result<number, string>> {
    if (input.distributionType === DistributionType.EQUAL) {
      return success(0);
    }

    const descendantIds = await this.organizationRepository.getDescendantIds(
      input.organizationId
    );
    const treeOrgIds = [input.organizationId, ...descendantIds];

    const assetsResult = await this.propertyAssetRepository.findAssetsInScope(
      treeOrgIds,
      input.propertyIds
    );

    if (!assetsResult.success) {
      return failure(assetsResult.error);
    }

    if (
      input.propertyAggregation === PropertyAggregation.NORMALIZE_PER_PROPERTY
    ) {
      const propIds = new Set(assetsResult.value.map((a) => a.propertyId));

      return success(propIds.size);
    }

    if (input.distributionType === DistributionType.OWNERSHIP_UNIT_COUNT) {
      return success(assetsResult.value.length);
    }

    // OWNERSHIP_SIZE_WEIGHTED + RAW_SUM
    return success(assetsResult.value.reduce((s, a) => s + a.size, 0));
  }
}
