// Pure weight-distribution function. Spec: readmes/2026-04-18-weight-distribution-types-design.md
//
// Unified formula across all ownership modes:
//   weight_i = Σⱼ (share_{i,j} × effective_size_j)   (per-property normalized when NORMALIZE_PER_PROPERTY)
// where effective_size is 1 for OWNERSHIP_UNIT_COUNT and asset.size for OWNERSHIP_SIZE_WEIGHTED.
//
// A single asset's total contribution never exceeds its effective_size: co-owners split the asset's
// contribution by their shares (if 2 people each own 50%, each gets 0.5× — not 1× each).

import { z } from 'zod';
import { AssetId, PropertyId, UserId } from '../shared/EntityIds';
import { AssetSize, OwnershipShare } from '../organization/PropertyValues';
import { VotingWeight } from './VotingWeight';
import { PollDomainCode, PollDomainCodes } from './PollDomainCodes';
import { Result, failure, success } from '../shared/Result';
import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';

export interface WeightAsset {
  id: AssetId;
  propertyId: PropertyId;
  size: AssetSize;
}

export interface WeightOwnership {
  assetId: AssetId;
  userId: UserId;
  share: OwnershipShare;
}

export interface WeightDistributionInput {
  candidates: UserId[];
  distributionType: DistributionType;
  // Empty propertyIds = no filter (all assets considered).
  propertyAggregation: PropertyAggregation;
  propertyIds: PropertyId[];
  assets: WeightAsset[];
  ownerships: WeightOwnership[];
}

export const WeightDistributionInput = z.object({
  candidates: z.array(UserId),
  distributionType: z.enum(DistributionType),
  propertyAggregation: z.enum(PropertyAggregation),
  propertyIds: z.array(PropertyId),
  assets: z.array(
    z.object({ id: AssetId, propertyId: PropertyId, size: AssetSize })
  ),
  ownerships: z.array(
    z.object({ assetId: AssetId, userId: UserId, share: OwnershipShare })
  ),
});

export function computeWeights(
  input: WeightDistributionInput
): Result<Map<UserId, VotingWeight>, PollDomainCode> {
  const values = WeightDistributionInput.safeParse(input);

  if (!values.success) {
    return failure(PollDomainCodes.INVALID_WEIGHT);
  }

  try {
    const weights = calculateWeights(values.data);

    return success(
      new Map(
        [...weights].map(([id, weight]) => [id, VotingWeight.parse(weight)])
      )
    );
  } catch {
    return failure(PollDomainCodes.INVALID_WEIGHT);
  }
}

function calculateWeights(input: WeightDistributionInput): Map<UserId, number> {
  const inScopeAssets = filterAssets(input.assets, input.propertyIds);
  const inScopeAssetIdSet = new Set(inScopeAssets.map((a) => a.id));
  const ownershipByUser = groupOwnershipByUser(
    input.ownerships,
    inScopeAssetIdSet
  );

  const out = new Map<UserId, number>();

  if (input.distributionType === DistributionType.EQUAL) {
    // EQUAL with empty scope: every candidate votes (membership is enough).
    // EQUAL with a non-empty scope: property scope doubles as an eligibility filter —
    // only candidates who own ≥1 in-scope asset get weight 1; non-owners are excluded.
    const scopeEmpty = input.propertyIds.length === 0;

    for (const userId of input.candidates) {
      if (scopeEmpty) {
        out.set(userId, 1);
      } else if ((ownershipByUser.get(userId)?.length ?? 0) > 0) {
        out.set(userId, 1);
      }
    }

    return out;
  }

  // Ownership modes. For UNIT_COUNT, every asset contributes equally (size=1);
  // for SIZE_WEIGHTED, contribution scales with the asset's real size.
  const effectiveSize = (a: WeightAsset): number =>
    input.distributionType === DistributionType.OWNERSHIP_UNIT_COUNT
      ? 1
      : a.size;

  const assetById = new Map<AssetId, WeightAsset>(
    inScopeAssets.map((a) => [a.id, a])
  );

  // Pre-group assets by property — needed for per-property normalization (denominator).
  const assetsByProperty = new Map<PropertyId, WeightAsset[]>();

  for (const a of inScopeAssets) {
    const list = assetsByProperty.get(a.propertyId) ?? [];
    list.push(a);
    assetsByProperty.set(a.propertyId, list);
  }

  const useNormalize =
    input.propertyAggregation === PropertyAggregation.NORMALIZE_PER_PROPERTY;

  for (const userId of input.candidates) {
    const userOwnerships = ownershipByUser.get(userId) ?? [];

    // Ownership modes: a candidate with no in-scope ownership has 0 weight and is omitted
    // from the result (caller filters them out of the participant list).
    if (userOwnerships.length === 0) {
      continue;
    }

    if (!useNormalize) {
      // RAW_SUM: absolute contributions. A bigger / larger-size property dominates
      // the final weight when multiple properties are in scope.
      let weight = 0;

      for (const o of userOwnerships) {
        const a = assetById.get(o.assetId);

        if (!a) {
          continue;
        }

        weight += o.share * effectiveSize(a);
      }

      if (!Number.isFinite(weight)) {
        throw new Error(PollDomainCodes.INVALID_WEIGHT);
      }

      if (weight > 0) {
        out.set(userId, weight);
      }

      continue;
    }

    // NORMALIZE_PER_PROPERTY: each property contributes at most 1.0 before summing.
    // Solves the mixed-unit problem (e.g., apartments in m² + parking spots as counts):
    // a user's share of each property is normalized to [0, 1] regardless of that property's
    // absolute scale, then added across properties.
    const userByProp = new Map<PropertyId, WeightOwnership[]>();

    for (const o of userOwnerships) {
      const a = assetById.get(o.assetId);

      if (!a) {
        continue;
      }

      const list = userByProp.get(a.propertyId) ?? [];
      list.push(o);
      userByProp.set(a.propertyId, list);
    }

    let weight = 0;

    for (const [propId, list] of userByProp) {
      const propAssets = assetsByProperty.get(propId) ?? [];
      // Denominator = sum of effective sizes across ALL assets in this property
      // (including those the user doesn't own) — that's why non-participant owners
      // dilute the weight rather than being ignored.
      const denom = propAssets.reduce((s, a) => s + effectiveSize(a), 0);

      if (!Number.isFinite(denom)) {
        throw new Error(PollDomainCodes.INVALID_WEIGHT);
      }

      if (denom === 0) {
        continue;
      }

      let num = 0;

      for (const o of list) {
        const a = assetById.get(o.assetId);

        if (!a) {
          continue;
        }

        num += o.share * effectiveSize(a);
      }

      weight += num / denom;
    }

    if (!Number.isFinite(weight)) {
      throw new Error(PollDomainCodes.INVALID_WEIGHT);
    }

    if (weight > 0) {
      out.set(userId, weight);
    }
  }

  return out;
}

function filterAssets(
  assets: WeightAsset[],
  propertyIds: PropertyId[]
): WeightAsset[] {
  if (propertyIds.length === 0) {
    return assets;
  }

  const set = new Set(propertyIds);

  return assets.filter((a) => set.has(a.propertyId));
}

function groupOwnershipByUser(
  ownerships: WeightOwnership[],
  inScopeAssetIds: Set<AssetId>
): Map<UserId, WeightOwnership[]> {
  const map = new Map<UserId, WeightOwnership[]>();

  for (const o of ownerships) {
    if (!inScopeAssetIds.has(o.assetId)) {
      continue;
    }

    const list = map.get(o.userId) ?? [];
    list.push(o);
    map.set(o.userId, list);
  }

  return map;
}
