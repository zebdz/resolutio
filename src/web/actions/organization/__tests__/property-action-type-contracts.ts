/** Property/claim action clients retain identity, quantities and valid owner/decision alternatives.
 * Compiler failures expose response annotations that erase already validated domain values. */
import {
  createPropertyAction,
  createAssetAction,
  listPropertiesAction,
  listAssetsAction,
  listActiveOwnershipForAssetAction,
  listOwnershipRowsAction,
  searchOrgTreeMembersAction,
} from '../property';
import {
  submitPropertyClaimAction,
  listClaimAttachmentsAction,
  listOrgPropertiesForMemberAction,
  listClaimableAssetsAction,
  listPendingClaimsForOrgAction,
  listMyClaimsForPropertyAction,
} from '../propertyClaim';
import {
  AssetId,
  PropertyId,
  OrganizationId,
  UserId,
  PollAttachmentId,
} from '@/domain/shared/EntityIds';
import {
  AssetName,
  PropertyName,
  OwnershipShare,
  ExternalOwnerLabel,
} from '@/domain/organization/PropertyValues';
import { AttachmentCount } from '@/domain/shared/attachments/AttachmentValues';
import { Instant } from '@/domain/shared/Instant';

type Data<Result> =
  Extract<Awaited<Result>, { success: true }> extends { data: infer View }
    ? View
    : never;
type CreatedProperty = Data<ReturnType<typeof createPropertyAction>>;
type CreatedAsset = Data<ReturnType<typeof createAssetAction>>;
type Property = Data<
  ReturnType<typeof listPropertiesAction>
>['properties'][number];
type Asset = Data<ReturnType<typeof listAssetsAction>>['assets'][number];
type Ownership = Data<
  ReturnType<typeof listActiveOwnershipForAssetAction>
>['ownerships'][number];
type History = Data<ReturnType<typeof listOwnershipRowsAction>>['rows'][number];
type Member = Data<
  ReturnType<typeof searchOrgTreeMembersAction>
>['matches'][number];
type Claim = Data<ReturnType<typeof submitPropertyClaimAction>>;
type Attachment = Data<ReturnType<typeof listClaimAttachmentsAction>>[number];
type MemberProperty = Data<
  ReturnType<typeof listOrgPropertiesForMemberAction>
>['properties'][number];
type ClaimableAsset = Data<
  ReturnType<typeof listClaimableAssetsAction>
>['assets'][number];
type PendingClaim = Data<
  ReturnType<typeof listPendingClaimsForOrgAction>
>['rows'][number];
type MyClaim = Data<
  ReturnType<typeof listMyClaimsForPropertyAction>
>['rows'][number];
type Placeholder = PendingClaim['placeholders'][number];

// @ts-expect-error Property creation returns a property identity, not an asset.
const assetAsCreatedProperty: CreatedProperty['propertyId'] =
  AssetId.parse('asset');
// @ts-expect-error Asset creation returns an asset identity, not its property.
const propertyAsCreatedAsset: CreatedAsset['assetId'] =
  PropertyId.parse('property');
// @ts-expect-error Property units remain a closed choice.
const unknownSizeUnit: Property['sizeUnit'] = 'UNKNOWN';
// @ts-expect-error An ownership fraction is not an asset size.
const shareAsSize: Asset['size'] = OwnershipShare.parse(0.5);
// @ts-expect-error A property list cannot contain asset identities.
const assetAsListedProperty: Property['id'] = AssetId.parse('asset');
// @ts-expect-error An asset list cannot contain property identities.
const propertyAsListedAsset: Asset['id'] = PropertyId.parse('property');
// @ts-expect-error Archived properties retain a validated instant or explicit absence.
const invalidPropertyArchive: Property['archivedAt'] = 'yesterday';
// @ts-expect-error Archived assets retain a validated instant or explicit absence.
const invalidAssetArchive: Asset['archivedAt'] = 'yesterday';
declare const ownership: Ownership;
// @ts-expect-error A row cannot have both a user and an external owner.
const ambiguousOwner: Ownership = {
  ...ownership,
  userId: UserId.parse('user'),
  externalOwnerLabel: ExternalOwnerLabel.parse('External'),
};
// @ts-expect-error An ownership row must have an owner.
const ownerless: Ownership = {
  ...ownership,
  userId: null,
  externalOwnerLabel: null,
};
// @ts-expect-error Historical effective times require validated instants.
const invalidHistoryTime: History['effectiveFrom'] = 'yesterday';
// @ts-expect-error A member search identifies a user, not their organization.
const orgAsMember: Member['id'] = OrganizationId.parse('org');
// @ts-expect-error Member organization labels retain validated organization names.
const uncheckedMemberOrg: Member['orgNames'][number] = '';
// @ts-expect-error A claim identity is distinct from the asset it claims.
const assetAsClaim: Claim['claimId'] = AssetId.parse('asset');
// @ts-expect-error Claim evidence is distinct from a poll attachment.
const pollFileAsClaimFile: Attachment['id'] = PollAttachmentId.parse('file');
// @ts-expect-error Counts of files cannot substitute for attachment byte sizes.
const countAsBytes: Attachment['sizeBytes'] = AttachmentCount.parse(1);
// @ts-expect-error Claim evidence filenames must retain their validated type.
const uncheckedClaimFileName: Attachment['fileName'] = '';
// @ts-expect-error Claim evidence MIME types remain a closed allowlist.
const disallowedClaimMime: Attachment['mimeType'] = 'text/html';
// @ts-expect-error A member's property list still contains property identities.
const assetAsMemberProperty: MemberProperty['id'] = AssetId.parse('asset');
// @ts-expect-error Member property names retain their property-specific type.
const assetNameAsMemberProperty: MemberProperty['name'] =
  AssetName.parse('Unit');
// @ts-expect-error A present property address must be validated.
const uncheckedMemberPropertyAddress: MemberProperty['address'] = '';
// @ts-expect-error Claimable assets are identified independently of their properties.
const propertyAsClaimableAsset: ClaimableAsset['id'] =
  PropertyId.parse('property');
// @ts-expect-error Claimable asset names remain distinct from property names.
const propertyNameAsClaimableAsset: ClaimableAsset['name'] =
  PropertyName.parse('Building');
// @ts-expect-error A claim's asset reference cannot be a property identity.
const propertyAsPendingAsset: PendingClaim['assetId'] =
  PropertyId.parse('property');
// @ts-expect-error A displayed percentage is not an ownership fraction.
const fractionAsPercent: Placeholder['sharePercent'] =
  OwnershipShare.parse(0.5);
// @ts-expect-error Claim status is a closed lifecycle choice.
const unknownClaimStatus: MyClaim['status'] = 'UNKNOWN';
declare const myClaim: MyClaim;
const pendingWithDecision = {
  ...myClaim,
  status: 'PENDING' as const,
  deniedReason: null,
  decidedAt: Instant.parse('2026-10-30T00:00:00.000Z'),
};
// @ts-expect-error A pending claim cannot carry even a valid decision time.
const decidedPendingClaim: MyClaim = pendingWithDecision;
const approvalWithoutTime = {
  ...myClaim,
  status: 'APPROVED' as const,
  deniedReason: null,
  decidedAt: null,
};
// @ts-expect-error Approved claims require their decision time.
const incompleteApproval: MyClaim = approvalWithoutTime;
const denialWithoutReason = {
  ...myClaim,
  status: 'DENIED' as const,
  deniedReason: null,
  decidedAt: Instant.parse('2026-10-30T00:00:00.000Z'),
};
// @ts-expect-error Denied claims require their reason as well as their decision time.
const incompleteDenial: MyClaim = denialWithoutReason;
