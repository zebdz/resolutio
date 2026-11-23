/** Claim response projections preserve lifecycle data and exact ownership percentages.
 * JSON assertions cover nested field filtering, including evidence bytes and private actors. */
import { expect, it } from 'vitest';
import { PropertyClaim } from '@/domain/organization/PropertyClaim';
import { PropertyAssetOwnership } from '@/domain/organization/PropertyAssetOwnership';
import type { PendingClaimListRow } from '@/domain/organization/PropertyClaimRepository';
import type { PropertyClaimAttachmentMetadata } from '@/domain/organization/PropertyClaimAttachmentRepository';
import {
  AssetName,
  ExternalOwnerLabel,
  PropertyName,
} from '@/domain/organization/PropertyValues';
import {
  PropertyClaimAttachmentId,
  PropertyId,
} from '@/domain/shared/EntityIds';
import {
  AttachmentByteCount,
  AttachmentFileName,
} from '@/domain/shared/attachments/AttachmentValues';
import { Instant } from '@/domain/shared/Instant';
import { FirstName, LastName } from '@/domain/user/UserValues';
import {
  serializeMyClaim,
  serializePendingClaim,
} from '../serializePropertyClaim';

const createdAt = Instant.parse('2026-11-04T12:00:00.000Z');
const decidedAt = '2026-11-04T12:34:56.789Z';
const claimProps = {
  id: 'claim-1',
  organizationId: 'org-1',
  userId: 'claimant-1',
  assetId: 'asset-1',
  createdAt: Instant.toDate(createdAt),
};

it.each([
  { status: 'PENDING', deniedReason: null, decidedBy: null, decidedAt: null },
  { status: 'APPROVED', deniedReason: null, decidedBy: 'admin-1', decidedAt },
  {
    status: 'DENIED',
    deniedReason: 'Proof missing',
    decidedBy: 'admin-1',
    decidedAt,
  },
  {
    status: 'DENIED',
    deniedReason: 'Asset archived',
    decidedBy: null,
    decidedAt,
  },
])(
  'serializes $status with decision actor $decidedBy without exposing private fields',
  (decision) => {
    const claim = PropertyClaim.reconstitute({
      ...claimProps,
      ...decision,
      decidedAt:
        decision.decidedAt === null ? null : new Date(decision.decidedAt),
    });
    const view = serializeMyClaim({
      claim,
      assetName: AssetName.parse('Unit'),
    });

    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(view))).toEqual({
      id: 'claim-1',
      assetName: 'Unit',
      status: decision.status,
      deniedReason: decision.deniedReason,
      createdAt,
      decidedAt: decision.decidedAt,
    });
  }
);

it.each([
  { share: 0, percentage: 0 },
  { share: 0.125, percentage: 12.5 },
  { share: 1, percentage: 100 },
])(
  'serializes external ownership share $share as $percentage percent with only allowed metadata',
  ({ share, percentage }) => {
    const claim = PropertyClaim.reconstitute({
      ...claimProps,
      status: 'PENDING',
      deniedReason: null,
      decidedBy: null,
      decidedAt: null,
    });
    const row: PendingClaimListRow = {
      claim,
      assetName: AssetName.parse('Unit'),
      propertyId: PropertyId.parse('property-1'),
      propertyName: PropertyName.parse('Building'),
      claimantFirstName: FirstName.parse('Alice'),
      claimantLastName: LastName.parse('Smith'),
      claimantMiddleName: null,
      externalOwnerLabel: ExternalOwnerLabel.parse('Recorded owner'),
    };
    const attachment: PropertyClaimAttachmentMetadata = {
      id: PropertyClaimAttachmentId.parse('attachment-1'),
      claimId: claim.id,
      fileName: AttachmentFileName.parse('proof.pdf'),
      mimeType: 'application/pdf',
      sizeBytes: AttachmentByteCount.parse(128),
      createdAt,
    };
    const attachmentWithBytes = {
      ...attachment,
      bytes: Buffer.from('private-evidence'),
    };
    const ownershipProps = {
      assetId: 'asset-1',
      effectiveFrom: Instant.toDate(createdAt),
      effectiveUntil: null,
      createdAt: Instant.toDate(createdAt),
    };
    const external = PropertyAssetOwnership.reconstitute({
      ...ownershipProps,
      id: 'ownership-external',
      userId: null,
      externalOwnerLabel: 'Recorded owner',
      share,
    });
    const registered = PropertyAssetOwnership.reconstitute({
      ...ownershipProps,
      id: 'ownership-user',
      userId: 'registered-owner',
      externalOwnerLabel: null,
      share: 1 - share,
    });
    const view = serializePendingClaim(
      row,
      [attachmentWithBytes],
      [external, registered]
    );

    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(view))).toEqual({
      id: 'claim-1',
      assetId: 'asset-1',
      assetName: 'Unit',
      propertyId: 'property-1',
      propertyName: 'Building',
      claimantFirstName: 'Alice',
      claimantLastName: 'Smith',
      claimantMiddleName: null,
      externalOwnerLabel: 'Recorded owner',
      createdAt,
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'proof.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 128,
        },
      ],
      placeholders: [
        {
          ownershipId: 'ownership-external',
          label: 'Recorded owner',
          sharePercent: percentage,
        },
      ],
    });
  }
);
