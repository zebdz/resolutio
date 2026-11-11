/** Typed claim persistence port with display projections. Attachments share the
 * claim transaction so a failed upload cannot strand a pending claim. */
import { FirstName, LastName, MiddleName } from '../user/UserValues';
import {
  OrganizationId,
  PropertyId,
  PropertyClaimId,
  AssetId,
  UserId,
} from '../shared/EntityIds';
import { AssetName, PropertyName, ExternalOwnerLabel } from './PropertyValues';
import { Result } from '../shared/Result';
import { PropertyClaim } from './PropertyClaim';
import { PropertyClaimAttachment } from './PropertyClaimAttachment';
export type PropertyClaimRepositoryError = 'common.errors.unexpected';

export interface PendingClaimListRow {
  claim: PropertyClaim;
  claimantFirstName: FirstName;
  claimantLastName: LastName;
  claimantMiddleName: MiddleName | null;
  assetName: AssetName;
  propertyId: PropertyId;
  propertyName: PropertyName;
  externalOwnerLabel: ExternalOwnerLabel | null;
}

export interface MyClaimListRow {
  claim: PropertyClaim;
  assetName: AssetName;
}

export interface PropertyClaimRepository {
  save(
    claim: PropertyClaim
  ): Promise<Result<PropertyClaim, PropertyClaimRepositoryError>>;

  // Atomic claim+attachment write. Either both rows land or neither does —
  // matters because a claim row with no proof a user uploaded would block
  // their re-submit (ALREADY_PENDING) while leaving an admin-visible claim
  // with the proof missing. Both objects refer to the caller-supplied claim id.
  saveWithOptionalAttachment(input: {
    claim: PropertyClaim;
    attachment?: {
      entity: PropertyClaimAttachment;
      bytes: Buffer;
    };
  }): Promise<Result<PropertyClaim, PropertyClaimRepositoryError>>;

  update(
    claim: PropertyClaim
  ): Promise<Result<void, PropertyClaimRepositoryError>>;
  findById(
    id: PropertyClaimId
  ): Promise<Result<PropertyClaim | null, PropertyClaimRepositoryError>>;

  findPendingForAsset(
    assetId: AssetId
  ): Promise<Result<PropertyClaim[], PropertyClaimRepositoryError>>;

  findLatestDecidedForUserAndAsset(
    userId: UserId,
    assetId: AssetId
  ): Promise<Result<PropertyClaim | null, PropertyClaimRepositoryError>>;

  findPendingForOrg(
    organizationId: OrganizationId
  ): Promise<Result<PendingClaimListRow[], PropertyClaimRepositoryError>>;

  findMyClaimsForProperty(
    userId: UserId,
    propertyId: PropertyId
  ): Promise<Result<MyClaimListRow[], PropertyClaimRepositoryError>>;

  findPendingForAssets(
    assetIds: AssetId[]
  ): Promise<Result<PropertyClaim[], PropertyClaimRepositoryError>>;

  getOrgAdminUserIds(
    organizationId: OrganizationId
  ): Promise<Result<UserId[], PropertyClaimRepositoryError>>;
}
