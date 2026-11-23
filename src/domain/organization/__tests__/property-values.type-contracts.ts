/** Compile-only property clients: distinct validated numeric units preserve
 * ordinary arithmetic while preventing unchecked inputs and swapped units. */
import { AssetSize, OwnershipShare } from '../PropertyValues';
import { AllOwnershipRow } from '../PropertyAssetRepository';

declare function holding(size: AssetSize, share: OwnershipShare): void;
const size = AssetSize.parse(12.3456789);
const share = OwnershipShare.parse(0.25);
holding(size, share);
const weightedSize: number = size * share;

declare const historyRow: AllOwnershipRow;
// @ts-expect-error Ownership history retains the exclusive owner alternative.
const ambiguousHistory: AllOwnershipRow = {
  ...historyRow,
  userId: UserId.parse('user'),
  externalOwnerLabel: ExternalOwnerLabel.parse('External'),
};
// @ts-expect-error Ownership history cannot lose both owner alternatives.
const ownerlessHistory: AllOwnershipRow = {
  ...historyRow,
  userId: null,
  externalOwnerLabel: null,
};

// @ts-expect-error A share and an asset size represent different units.
holding(share, size);
// @ts-expect-error A raw size has not been validated.
holding(12, share);
// @ts-expect-error A raw ownership fraction has not been validated.
holding(size, 0.25);

import { PropertyAsset } from '../PropertyAsset';
import { PropertyAssetOwnership, AssetOwner } from '../PropertyAssetOwnership';
import { AssetName, ExternalOwnerLabel } from '../PropertyValues';
import {
  AssetId,
  PropertyId,
  OwnershipId,
  UserId,
} from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
const now = Instant.parse('2026-01-01T00:00:00.000Z');
const propertyId = PropertyId.parse('property');
const assetId = AssetId.parse('asset');
const userId = UserId.parse('user');
const ownershipId = OwnershipId.parse('ownership');
const name = AssetName.parse('Unit');
const asset = PropertyAsset.create(propertyId, name, size, {
  id: assetId,
  now,
});
PropertyAssetOwnership.createForUser(assetId, userId, share, {
  id: ownershipId,
  now,
});
// @ts-expect-error A valid asset requires caller-supplied identity and time.
PropertyAsset.create(propertyId, name, size);
// @ts-expect-error An asset identity cannot be used as its property identity.
PropertyAsset.create(assetId, name, size, { id: assetId, now });
// @ts-expect-error A descriptive string is not a validated asset name.
PropertyAsset.create(propertyId, 'Unit', size, { id: assetId, now });
// @ts-expect-error Asset size cannot be used as an ownership fraction.
PropertyAssetOwnership.createForUser(assetId, userId, size, {
  id: ownershipId,
  now,
});
// @ts-expect-error External owners require a nonempty validated label.
const missingOwner: AssetOwner = { kind: 'external' };
const ambiguousOwner: AssetOwner = {
  kind: 'user',
  userId,
  // @ts-expect-error The user alternative cannot also contain an external label.
  label: ExternalOwnerLabel.parse('Unknown'),
};

if (asset.success) {
  asset.value.archive(now);
  // @ts-expect-error Mutable Date objects are an I/O representation, not domain time.
  asset.value.archive(new Date());
}

import { OrganizationProperty } from '../OrganizationProperty';
import { PropertyClaim, PropertyClaimDecision } from '../PropertyClaim';
import { PropertyName } from '../PropertyValues';
import { OrganizationId, PropertyClaimId } from '../../shared/EntityIds';
const organizationId = OrganizationId.parse('organization');
const claimId = PropertyClaimId.parse('claim');
const propertyName = PropertyName.parse('Building');
OrganizationProperty.create(
  organizationId,
  propertyName,
  null,
  'SQUARE_METERS',
  { id: propertyId, now }
);
PropertyClaim.submit(organizationId, userId, assetId, { id: claimId, now });
// @ts-expect-error A property's identity must not be used as its organization identity.
OrganizationProperty.create(propertyId, propertyName, null, 'SQUARE_METERS', {
  id: propertyId,
  now,
});
// @ts-expect-error A claim requires caller-supplied creation identity and time.
PropertyClaim.submit(organizationId, userId, assetId);
// @ts-expect-error Approved decisions require both actor and time.
const incompleteApproval: PropertyClaimDecision = {
  status: 'APPROVED',
  at: now,
};
// @ts-expect-error Pending claims have no decision metadata.
const decidedPending: PropertyClaimDecision = { status: 'PENDING', at: now };
// @ts-expect-error Denied claims require a validated reason.
const incompleteDenial: PropertyClaimDecision = {
  status: 'DENIED',
  at: now,
  actor: { kind: 'system' },
};
