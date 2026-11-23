/** Ownership behavior validates shares and owner alternatives while preserving
 * caller-supplied identity and immutable lifecycle instants. */
import { describe, it, expect } from 'vitest';
import { PropertyAssetOwnership } from '../PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { AssetId, OwnershipId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { ExternalOwnerLabel, OwnershipShare } from '../PropertyValues';

const at = Instant.parse('2026-01-01T00:00:00.000Z');
const creation = { id: OwnershipId.parse('ownership-1'), now: at };

// Negative cases bypass brands deliberately to test domain runtime guards.
function createForUser(assetId: string, userId: string, share: number) {
  return PropertyAssetOwnership.createForUser(
    AssetId.parse(assetId),
    UserId.parse(userId),
    share as OwnershipShare,
    creation
  );
}

function createForExternalOwner(assetId: string, label: string, share: number) {
  return PropertyAssetOwnership.createForExternalOwner(
    AssetId.parse(assetId),
    label as ExternalOwnerLabel,
    share as OwnershipShare,
    creation
  );
}

describe('PropertyAssetOwnership', () => {
  it.each([
    { userId: 'u-1', externalOwnerLabel: 'External owner' },
    { userId: null, externalOwnerLabel: null },
  ])('rejects ambiguous or missing persisted owner columns: %j', (owner) => {
    expect(() =>
      PropertyAssetOwnership.reconstitute({
        id: 'ownership-1',
        assetId: 'asset-1',
        ...owner,
        share: 1,
        effectiveFrom: new Date(at),
        effectiveUntil: null,
        createdAt: new Date(at),
      })
    ).toThrow(OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID);
  });

  describe('createForUser', () => {
    it('rejects non-finite shares', () => {
      for (const share of [NaN, Infinity, -Infinity]) {
        expect(createForUser('asset-1', 'u-1', share).success).toBe(false);
      }
    });

    it('creates with userId and share in [0,1]', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);
      expect(r.success).toBe(true);

      if (r.success) {
        expect(r.value.userId).toBe('u-1');
        expect(r.value.externalOwnerLabel).toBeNull();
        expect(r.value.share).toBe(0.5);
      }
    });

    it('rejects share > 1', () => {
      const r = createForUser('asset-1', 'u-1', 1.5);
      expect(r.success).toBe(false);
    });

    it('rejects share < 0', () => {
      const r = createForUser('asset-1', 'u-1', -0.1);
      expect(r.success).toBe(false);
    });
  });

  describe('createForExternalOwner', () => {
    it('creates with a non-empty label', () => {
      const r = createForExternalOwner(
        'asset-1',
        'Apartment owner of record',
        1
      );
      expect(r.success).toBe(true);

      if (r.success) {
        expect(r.value.userId).toBeNull();
        expect(r.value.externalOwnerLabel).toBe('Apartment owner of record');
        expect(r.value.share).toBe(1);
      }
    });

    it('rejects empty label', () => {
      const r = createForExternalOwner('asset-1', '   ', 1);
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY
        );
      }
    });
  });

  describe('link (claim approval)', () => {
    it('fills userId and clears label', () => {
      const r = createForExternalOwner('asset-1', 'Owner X', 1);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.link(UserId.parse('u-42'));
      expect(res.success).toBe(true);
      expect(r.value.userId).toBe('u-42');
      expect(r.value.externalOwnerLabel).toBeNull();
    });

    it('rejects when already linked to a user', () => {
      const r = createForUser('asset-1', 'u-1', 1);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.link(UserId.parse('u-2'));
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID
        );
      }
    });

    it('rejects when row is inactive', () => {
      const r = createForExternalOwner('asset-1', 'X', 1);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(Instant.fromDate(new Date('2026-05-01')));
      const res = r.value.link(UserId.parse('u-1'));
      expect(res.success).toBe(false);
    });
  });

  describe('correct (SCD-1 in-place share update)', () => {
    it('updates share on an active row', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.correct(0.7 as OwnershipShare);
      expect(res.success).toBe(true);
      expect(r.value.share).toBe(0.7);
    });

    it('rejects out-of-range share', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      expect(r.value.correct(-0.1 as OwnershipShare).success).toBe(false);
      expect(r.value.correct(1.1 as OwnershipShare).success).toBe(false);
    });

    it('rejects when row is inactive', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(Instant.fromDate(new Date('2026-05-01')));
      const res = r.value.correct(0.8 as OwnershipShare);
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE
        );
      }
    });
  });

  describe('endEffect', () => {
    it('sets effectiveUntil to a given date', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      const d = new Date('2026-05-01');
      r.value.endEffect(Instant.fromDate(d));
      expect(r.value.effectiveUntil).toEqual(d);
    });

    it('does not overwrite an already-ended row', () => {
      const r = createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(Instant.fromDate(new Date('2026-05-01')));
      r.value.endEffect(Instant.fromDate(new Date('2026-06-01')));
      expect(r.value.effectiveUntil).toEqual(new Date('2026-05-01'));
    });
  });
});
