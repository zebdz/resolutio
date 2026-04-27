import { Result } from '../shared/Result';
import { PropertyClaim } from './PropertyClaim';
import { PropertyClaimAttachment } from './PropertyClaimAttachment';

export interface PendingClaimListRow {
  claim: PropertyClaim;
  claimantFirstName: string;
  claimantLastName: string;
  claimantMiddleName: string | null;
  assetName: string;
  propertyId: string;
  propertyName: string;
  externalOwnerLabel: string | null;
}

export interface MyClaimListRow {
  claim: PropertyClaim;
  assetName: string;
}

export interface PropertyClaimRepository {
  save(claim: PropertyClaim): Promise<Result<PropertyClaim, string>>;

  // Atomic claim+attachment write. Either both rows land or neither does —
  // matters because a claim row with no proof a user uploaded would block
  // their re-submit (ALREADY_PENDING) while leaving an admin-visible claim
  // with the proof missing. The attachment's claimId is filled in by the
  // implementation using the just-created claim's id.
  saveWithOptionalAttachment(input: {
    claim: PropertyClaim;
    attachment?: {
      entity: PropertyClaimAttachment;
      bytes: Buffer;
    };
  }): Promise<Result<PropertyClaim, string>>;

  update(claim: PropertyClaim): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<PropertyClaim | null, string>>;

  findPendingForAsset(
    assetId: string
  ): Promise<Result<PropertyClaim[], string>>;

  findLatestDecidedForUserAndAsset(
    userId: string,
    assetId: string
  ): Promise<Result<PropertyClaim | null, string>>;

  findPendingForOrg(
    organizationId: string
  ): Promise<Result<PendingClaimListRow[], string>>;

  findMyClaimsForProperty(
    userId: string,
    propertyId: string
  ): Promise<Result<MyClaimListRow[], string>>;

  findPendingForAssets(
    assetIds: string[]
  ): Promise<Result<PropertyClaim[], string>>;

  getOrgAdminUserIds(organizationId: string): Promise<Result<string[], string>>;
}
