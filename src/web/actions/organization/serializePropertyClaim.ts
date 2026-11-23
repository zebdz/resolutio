/** Claim-list projections retain validated values and valid decision alternatives.
 * Explicit field selection keeps claimant/decision identities and attachment bytes server-side. */
import type { PropertyClaim } from '@/domain/organization/PropertyClaim';
import type { PropertyAssetOwnership } from '@/domain/organization/PropertyAssetOwnership';
import type { PropertyClaimAttachmentMetadata } from '@/domain/organization/PropertyClaimAttachmentRepository';
import type {
  PendingClaimListRow,
  MyClaimListRow,
} from '@/domain/organization/PropertyClaimRepository';
import {
  OwnershipPercentage,
  type ClaimDenialReason,
} from '@/domain/organization/PropertyValues';
import { Instant } from '@/domain/shared/Instant';

export function serializePendingClaim(
  row: PendingClaimListRow,
  attachments: readonly PropertyClaimAttachmentMetadata[],
  ownerships: readonly PropertyAssetOwnership[]
) {
  // Placeholder ownership rows on the claimed asset. Drives the slot
  // picker when there are 2+ external owners — admin must choose
  // which one the claimant is, otherwise approval is rejected.
  const placeholders = ownerships.flatMap((ownership) => {
    const owner = ownership.owner;

    if (owner.kind !== 'external') {
      return [];
    }

    return [
      {
        ownershipId: ownership.id,
        label: owner.label,
        sharePercent: OwnershipPercentage.parse(ownership.share * 100),
      },
    ];
  });

  return {
    id: row.claim.id,
    assetId: row.claim.assetId,
    assetName: row.assetName,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    claimantFirstName: row.claimantFirstName,
    claimantLastName: row.claimantLastName,
    claimantMiddleName: row.claimantMiddleName,
    externalOwnerLabel: row.externalOwnerLabel,
    createdAt: Instant.fromDate(row.claim.createdAt),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })),
    placeholders,
  };
}

export type PendingClaimView = ReturnType<typeof serializePendingClaim>;
export type PendingClaimsView = { rows: PendingClaimView[] };

type MyClaimDecisionView =
  | { status: 'PENDING'; deniedReason: null; decidedAt: null }
  | { status: 'APPROVED'; deniedReason: null; decidedAt: Instant }
  | { status: 'DENIED'; deniedReason: ClaimDenialReason; decidedAt: Instant };

export type MyClaimView = {
  id: PropertyClaim['id'];
  assetName: MyClaimListRow['assetName'];
  createdAt: Instant;
} & MyClaimDecisionView;
export type MyClaimsView = { rows: MyClaimView[] };

export function serializeMyClaim(row: MyClaimListRow): MyClaimView {
  const common = {
    id: row.claim.id,
    assetName: row.assetName,
    createdAt: Instant.fromDate(row.claim.createdAt),
  };
  const decision = row.claim.decision;

  switch (decision.status) {
    case 'PENDING':
      return {
        ...common,
        status: decision.status,
        deniedReason: null,
        decidedAt: null,
      };
    case 'APPROVED':
      return {
        ...common,
        status: decision.status,
        deniedReason: null,
        decidedAt: decision.at,
      };
    case 'DENIED':
      return {
        ...common,
        status: decision.status,
        deniedReason: decision.reason,
        decidedAt: decision.at,
      };
  }
}
