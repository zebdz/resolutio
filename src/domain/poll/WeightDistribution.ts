// Pure weight-distribution function. Spec: readmes/2026-04-18-weight-distribution-types-design.md
//
// Unified formula across all ownership modes:
//   weight_i = Σⱼ (share_{i,j} × effective_size_j)   (per-property normalized when NORMALIZE_PER_PROPERTY)
// where effective_size is 1 for OWNERSHIP_UNIT_COUNT and asset.size for OWNERSHIP_SIZE_WEIGHTED.
//
// A single asset's total contribution never exceeds its effective_size: co-owners split the asset's
// contribution by their shares (if 2 people each own 50%, each gets 0.5× — not 1× each).

import { DistributionType } from './DistributionType';
import { PropertyAggregation } from './PropertyAggregation';

export interface WeightAsset {
  id: string;
  propertyId: string;
  size: number;
}

export interface WeightOwnership {
  assetId: string;
  userId: string;
  share: number;
}

export interface WeightDistributionInput {
  candidates: string[];
  distributionType: DistributionType;
  // Empty propertyIds = no filter (all assets considered).
  propertyAggregation: PropertyAggregation;
  propertyIds: string[];
  assets: WeightAsset[];
  ownerships: WeightOwnership[];
}

export function computeWeights(
  input: WeightDistributionInput
): Map<string, number> {
  const inScopeAssets = filterAssets(input.assets, input.propertyIds);
  const inScopeAssetIdSet = new Set(inScopeAssets.map((a) => a.id));
  const ownershipByUser = groupOwnershipByUser(
    input.ownerships,
    inScopeAssetIdSet
  );

  const out = new Map<string, number>();

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

  const assetById = new Map<string, WeightAsset>(
    inScopeAssets.map((a) => [a.id, a])
  );

  // Pre-group assets by property — needed for per-property normalization (denominator).
  const assetsByProperty = new Map<string, WeightAsset[]>();

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

      if (weight > 0) {
        out.set(userId, weight);
      }

      continue;
    }

    // NORMALIZE_PER_PROPERTY: each property contributes at most 1.0 before summing.
    // Solves the mixed-unit problem (e.g., apartments in m² + parking spots as counts):
    // a user's share of each property is normalized to [0, 1] regardless of that property's
    // absolute scale, then added across properties.
    const userByProp = new Map<string, WeightOwnership[]>();

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

    if (weight > 0) {
      out.set(userId, weight);
    }
  }

  return out;
}

function filterAssets(
  assets: WeightAsset[],
  propertyIds: string[]
): WeightAsset[] {
  if (propertyIds.length === 0) {
    return assets;
  }

  const set = new Set(propertyIds);

  return assets.filter((a) => set.has(a.propertyId));
}

function groupOwnershipByUser(
  ownerships: WeightOwnership[],
  inScopeAssetIds: Set<string>
): Map<string, WeightOwnership[]> {
  const map = new Map<string, WeightOwnership[]>();

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
