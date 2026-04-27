import { Result } from '../shared/Result';
import { PropertyAsset } from './PropertyAsset';
import { PropertyAssetOwnership } from './PropertyAssetOwnership';

export interface AssetOwnershipRow {
  asset: PropertyAsset;
  ownership: PropertyAssetOwnership;
}

export interface OwnershipRowToInsert {
  userId: string | null;
  externalOwnerLabel: string | null;
  share: number;
}

export interface AllOwnershipRow {
  id: string;
  assetId: string;
  assetName: string;
  propertyId: string;
  propertyName: string;
  userId: string | null;
  // Pre-formatted display label for the owning user when userId is set.
  // Null for external-owner rows.
  userLabel: string | null;
  externalOwnerLabel: string | null;
  share: number;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

export interface AllOwnershipFilter {
  organizationId: string;
  activeOnly: boolean;
  // Substring-matched against user first/last/middle/nickname OR the
  // externalOwnerLabel — whichever is set on the row. Case-insensitive.
  ownerQuery?: string;
  // Substring-matched against asset name. Case-insensitive.
  assetQuery?: string;
  propertyId?: string;
}

export interface PropertyAssetRepository {
  findCurrentOwnershipByOrg(
    organizationId: string,
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>>;

  // Tree-aware variant for cross-tree polls: searches ownership in any of the
  // given orgIds (typically [rootOrgId, ...descendants]). Poll paths should use
  // this; single-org admin pages can still use `findCurrentOwnershipByOrg`.
  findCurrentOwnership(
    organizationIds: string[],
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>>;

  // Returns every non-archived asset in the in-scope orgs/properties — once
  // per asset, regardless of how many ownership rows it has (or whether it
  // has any). Used by the snapshot to compute per-property denominators
  // correctly: deriving the asset list from ownership rows would double-count
  // multi-owner assets and miss ownerless ones.
  findAssetsInScope(
    organizationIds: string[],
    propertyIds: string[]
  ): Promise<
    Result<Array<{ id: string; propertyId: string; size: number }>, string>
  >;

  // Tree-aware: returns true if the org OR any descendant org has any active
  // ownership row. Reflects what a poll on this org could actually scope into,
  // since polls can include descendant orgs' properties.
  orgHasOwnershipData(organizationId: string): Promise<Result<boolean, string>>;

  // Tree-aware: true if the user holds any active ownership in the org or any
  // descendant. Same scope as `orgHasOwnershipData` for consistency in the
  // poll-creation gate.
  hasUserOwnership(
    organizationId: string,
    userId: string
  ): Promise<Result<boolean, string>>;

  // Read: list assets for admin
  findAssetsByProperty(
    propertyId: string,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], string>>;

  findAssetById(assetId: string): Promise<Result<PropertyAsset | null, string>>;

  findActiveOwnershipForAsset(
    assetId: string
  ): Promise<Result<PropertyAssetOwnership[], string>>;

  findOwnershipById(
    ownershipId: string
  ): Promise<Result<PropertyAssetOwnership | null, string>>;

  // Flat cross-property ownership query for admin ManageOwnership page.
  findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], string>>;

  findClaimableAssets(
    propertyId: string
  ): Promise<Result<{ id: string; name: string }[], string>>;

  // Write: assets
  saveAsset(asset: PropertyAsset): Promise<Result<PropertyAsset, string>>;
  updateAsset(asset: PropertyAsset): Promise<Result<void, string>>;

  // Atomic batch ownership replace. End-dates all currently active rows for
  // `assetId` at `at` and inserts `inserts`. Returns failure if any row fails.
  replaceOwners(input: {
    assetId: string;
    at: Date;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, string>>;

  // SCD-1 in-place share update.
  correctOwnership(input: {
    ownershipId: string;
    newShare: number;
  }): Promise<Result<void, string>>;

  // Claim-approval link: set userId, clear externalOwnerLabel in place.
  linkOwnershipToUser(input: {
    ownershipId: string;
    userId: string;
  }): Promise<Result<void, string>>;

  // Claim-approval create: insert a new active ownership row when the asset
  // had no active rows at all (admin added the asset without specifying any
  // owner; first claim becomes the 100% owner). Distinct from
  // `linkOwnershipToUser` so the approval use case can branch on which
  // operation matches the asset's actual state.
  createOwnershipForUser(input: {
    assetId: string;
    userId: string;
    share: number;
  }): Promise<Result<void, string>>;

  // Claim-approval reconcile: claimant already has an active row on the
  // asset, so instead of linking the placeholder (which would create two
  // rows for the same user) we end-date the placeholder and roll its
  // share into the existing row. Atomic — both writes in one transaction.
  mergePlaceholderIntoExistingOwner(input: {
    placeholderOwnershipId: string;
    existingOwnershipId: string;
    newShare: number;
  }): Promise<Result<void, string>>;
}
