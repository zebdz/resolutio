/** Typed property persistence port. Domain values remain distinct across reads and
 * writes; raw request/ORM data is validated by their respective boundary adapters. */
import { Result } from '../shared/Result';
import {
  AssetId,
  PropertyId,
  OwnershipId,
  UserId,
  OrganizationId,
} from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import {
  AssetName,
  PropertyName,
  AssetSize,
  ExternalOwnerLabel,
  OwnershipShare,
} from './PropertyValues';
import { SizeUnitValue } from './SizeUnit';
import { OrganizationDomainCode } from './OrganizationDomainCodes';

import { PropertyAsset } from './PropertyAsset';
import { AssetOwner, PropertyAssetOwnership } from './PropertyAssetOwnership';

export type PropertyAssetRepositoryError =
  | OrganizationDomainCode
  | 'common.errors.unexpected';

export interface AssetOwnershipRow {
  asset: PropertyAsset;
  ownership: PropertyAssetOwnership;
}

export interface OwnershipRowToInsert {
  readonly id: OwnershipId;
  readonly owner: AssetOwner;
  readonly share: OwnershipShare;
  readonly createdAt: Instant;
}

/** Plain owner projections preserve the domain's exclusive user/external alternative. */
export type OwnershipOwnerProjection =
  | {
      readonly userId: UserId;
      // Pre-formatted display label for the owning user when userId is set.
      // Null when the profile was not available to the reader.
      readonly userLabel: string | null;
      readonly externalOwnerLabel: null;
    }
  | {
      readonly userId: null;
      // External-owner rows never contain a user profile label.
      readonly userLabel: null;
      readonly externalOwnerLabel: ExternalOwnerLabel;
    };

/** Typed read projection for ownership history; owner columns come from the validated union. */
export type AllOwnershipRow = {
  id: OwnershipId;
  assetId: AssetId;
  assetName: AssetName;
  propertyId: PropertyId;
  propertyName: PropertyName;
  share: OwnershipShare;
  effectiveFrom: Instant;
  effectiveUntil: Instant | null;
} & OwnershipOwnerProjection;

export interface AllOwnershipFilter {
  organizationId: OrganizationId;
  activeOnly: boolean;
  // Substring-matched against user first/last/middle/nickname OR the
  // externalOwnerLabel — whichever is set on the row. Case-insensitive.
  ownerQuery?: string;
  // Substring-matched against asset name. Case-insensitive.
  assetQuery?: string;
  propertyId?: PropertyId;
}

// One owned asset, as it stood at a point in time. Feeds the named protocol's
// participant register, which must describe the holdings that produced the
// weight printed beside them — not whatever the person owns today.
export interface HoldingRow {
  userId: UserId;
  propertyName: PropertyName;
  assetName: AssetName;
  size: AssetSize;
  sizeUnit: SizeUnitValue;
  share: OwnershipShare;
}

export interface PropertyAssetRepository {
  findCurrentOwnershipByOrg(
    organizationId: OrganizationId,
    propertyIds: PropertyId[]
  ): Promise<Result<AssetOwnershipRow[], PropertyAssetRepositoryError>>;

  // Tree-aware variant for cross-tree polls: searches ownership in any of the
  // given orgIds (typically [rootOrgId, ...descendants]). Poll paths should use
  // this; single-org admin pages can still use `findCurrentOwnershipByOrg`.
  findCurrentOwnership(
    organizationIds: OrganizationId[],
    propertyIds: PropertyId[]
  ): Promise<Result<AssetOwnershipRow[], PropertyAssetRepositoryError>>;

  // Returns every non-archived asset in the in-scope orgs/properties — once
  // per asset, regardless of how many ownership rows it has (or whether it
  // has any). Used by the snapshot to compute per-property denominators
  // correctly: deriving the asset list from ownership rows would double-count
  // multi-owner assets and miss ownerless ones.
  findAssetsInScope(
    organizationIds: OrganizationId[],
    propertyIds: PropertyId[]
  ): Promise<
    Result<
      Array<{ id: AssetId; propertyId: PropertyId; size: AssetSize }>,
      PropertyAssetRepositoryError
    >
  >;

  // Point-in-time ownership for a fixed set of users. `asOf` is normally a
  // poll participant's snapshotAt. External-owner rows (userId null) are
  // excluded — they have no participant to attribute holdings to.
  findHoldingsAsOf(input: {
    organizationIds: OrganizationId[];
    propertyIds: PropertyId[];
    userIds: UserId[];
    asOf: Instant;
  }): Promise<Result<HoldingRow[], PropertyAssetRepositoryError>>;

  // Tree-aware: returns true if the org OR any descendant org has any active
  // ownership row. Reflects what a poll on this org could actually scope into,
  // since polls can include descendant orgs' properties.
  orgHasOwnershipData(
    organizationId: OrganizationId
  ): Promise<Result<boolean, PropertyAssetRepositoryError>>;

  // Tree-aware: true if the user holds any active ownership in the org or any
  // descendant. Same scope as `orgHasOwnershipData` for consistency in the
  // poll-creation gate.
  hasUserOwnership(
    organizationId: OrganizationId,
    userId: UserId
  ): Promise<Result<boolean, PropertyAssetRepositoryError>>;

  // Read: list assets for admin
  findAssetsByProperty(
    propertyId: PropertyId,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], PropertyAssetRepositoryError>>;

  findAssetById(
    assetId: AssetId
  ): Promise<Result<PropertyAsset | null, PropertyAssetRepositoryError>>;

  findActiveOwnershipForAsset(
    assetId: AssetId
  ): Promise<Result<PropertyAssetOwnership[], PropertyAssetRepositoryError>>;

  findOwnershipById(
    ownershipId: OwnershipId
  ): Promise<
    Result<PropertyAssetOwnership | null, PropertyAssetRepositoryError>
  >;

  // Flat cross-property ownership query for admin ManageOwnership page.
  findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], PropertyAssetRepositoryError>>;

  findClaimableAssets(
    propertyId: PropertyId
  ): Promise<
    Result<{ id: AssetId; name: AssetName }[], PropertyAssetRepositoryError>
  >;

  // Write: assets
  saveAsset(
    asset: PropertyAsset
  ): Promise<Result<PropertyAsset, PropertyAssetRepositoryError>>;
  updateAsset(
    asset: PropertyAsset
  ): Promise<Result<void, PropertyAssetRepositoryError>>;

  // Atomic batch ownership replace. End-dates all currently active rows for
  // `assetId` at `at` and inserts `inserts`. Returns failure if any row fails.
  replaceOwners(input: {
    assetId: AssetId;
    at: Instant;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, PropertyAssetRepositoryError>>;

  // SCD-1 in-place share update.
  correctOwnership(input: {
    ownershipId: OwnershipId;
    newShare: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>>;

  // Claim-approval link: set userId, clear externalOwnerLabel in place.
  linkOwnershipToUser(input: {
    ownershipId: OwnershipId;
    userId: UserId;
  }): Promise<Result<void, PropertyAssetRepositoryError>>;

  // Claim-approval create: insert a new active ownership row when the asset
  // had no active rows at all (admin added the asset without specifying any
  // owner; first claim becomes the 100% owner). Distinct from
  // `linkOwnershipToUser` so the approval use case can branch on which
  // operation matches the asset's actual state.
  createOwnershipForUser(input: {
    ownershipId: OwnershipId;
    at: Instant;
    assetId: AssetId;
    userId: UserId;
    share: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>>;

  // Claim-approval reconcile: claimant already has an active row on the
  // asset, so instead of linking the placeholder (which would create two
  // rows for the same user) we end-date the placeholder and roll its
  // share into the existing row. Atomic — both writes in one transaction.
  mergePlaceholderIntoExistingOwner(input: {
    at: Instant;
    placeholderOwnershipId: OwnershipId;
    existingOwnershipId: OwnershipId;
    newShare: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>>;
}
