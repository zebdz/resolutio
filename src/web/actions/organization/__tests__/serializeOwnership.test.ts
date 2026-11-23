/** Ownership responses retain their wire shape and exclusive owner alternatives.
 * Serialization exposes only selected fields, including when source rows gain private data. */
import { describe, expect, it } from 'vitest';
import { PropertyAssetOwnership } from '@/domain/organization/PropertyAssetOwnership';
import type {
  AllOwnershipRow,
  OwnershipOwnerProjection,
} from '@/domain/organization/PropertyAssetRepository';
import {
  AssetName,
  ExternalOwnerLabel,
  OwnershipShare,
  PropertyName,
} from '@/domain/organization/PropertyValues';
import {
  AssetId,
  OwnershipId,
  PropertyId,
  UserId,
} from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import {
  serializeActiveOwnership,
  serializeOwnershipRow,
} from '../serializeProperty';

const userId = UserId.parse('user-1');
const at = Instant.parse('2026-11-04T00:00:00.000Z');
const ownerCases = [
  { userId, userLabel: 'Member (@member)', externalOwnerLabel: null },
  {
    userId: null,
    userLabel: null,
    externalOwnerLabel: ExternalOwnerLabel.parse('External owner'),
  },
] satisfies OwnershipOwnerProjection[];

describe('ownership response serialization', () => {
  it.each(ownerCases)(
    'serializes active ownership with owner $userId / $externalOwnerLabel',
    (owner) => {
      const ownership = PropertyAssetOwnership.reconstitute({
        id: 'ownership-1',
        assetId: 'asset-1',
        userId: owner.userId,
        externalOwnerLabel: owner.externalOwnerLabel,
        share: 0.12345678,
        effectiveFrom: Instant.toDate(at),
        effectiveUntil: null,
        createdAt: Instant.toDate(at),
      });
      const view = serializeActiveOwnership(
        ownership,
        new Map([[userId, 'Member (@member)']])
      );

      expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
      expect(JSON.parse(JSON.stringify(view))).toEqual({
        id: 'ownership-1',
        share: 0.12345678,
        ...owner,
      });
    }
  );

  it('keeps a user owner when their display profile is unavailable', () => {
    const ownership = PropertyAssetOwnership.reconstitute({
      id: 'ownership-1',
      assetId: 'asset-1',
      userId,
      externalOwnerLabel: null,
      share: 0,
      effectiveFrom: Instant.toDate(at),
      effectiveUntil: null,
      createdAt: Instant.toDate(at),
    });

    expect(serializeActiveOwnership(ownership, new Map())).toEqual({
      id: 'ownership-1',
      share: 0,
      userId,
      userLabel: null,
      externalOwnerLabel: null,
    });
  });

  it.each(ownerCases)(
    'serializes history with owner $userId / $externalOwnerLabel without extra source fields',
    (owner) => {
      const expected: AllOwnershipRow = {
        id: OwnershipId.parse('ownership-1'),
        assetId: AssetId.parse('asset-1'),
        assetName: AssetName.parse('Unit'),
        propertyId: PropertyId.parse('property-1'),
        propertyName: PropertyName.parse('Building'),
        share: OwnershipShare.parse(0.12345678),
        effectiveFrom: at,
        effectiveUntil: null,
        ...owner,
      };
      const source = { ...expected, privateAuditNote: 'server-only' };
      const view = serializeOwnershipRow(source);

      expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
      expect(JSON.parse(JSON.stringify(view))).toEqual(expected);
      expect(view).not.toHaveProperty('privateAuditNote');
    }
  );
});
