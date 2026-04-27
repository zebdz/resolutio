import { describe, it, expect } from 'vitest';
import { PropertyAssetOwnership } from '../PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('PropertyAssetOwnership', () => {
  describe('createForUser', () => {
    it('creates with userId and share in [0,1]', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);
      expect(r.success).toBe(true);

      if (r.success) {
        expect(r.value.userId).toBe('u-1');
        expect(r.value.externalOwnerLabel).toBeNull();
        expect(r.value.share).toBe(0.5);
      }
    });

    it('rejects share > 1', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 1.5);
      expect(r.success).toBe(false);
    });

    it('rejects share < 0', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', -0.1);
      expect(r.success).toBe(false);
    });
  });

  describe('createForExternalOwner', () => {
    it('creates with a non-empty label', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
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
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        '   ',
        1
      );
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
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        'Owner X',
        1
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.link('u-42');
      expect(res.success).toBe(true);
      expect(r.value.userId).toBe('u-42');
      expect(r.value.externalOwnerLabel).toBeNull();
    });

    it('rejects when already linked to a user', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 1);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.link('u-2');
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.OWNER_REPRESENTATION_INVALID
        );
      }
    });

    it('rejects when row is inactive', () => {
      const r = PropertyAssetOwnership.createForExternalOwner(
        'asset-1',
        'X',
        1
      );

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(new Date('2026-05-01'));
      const res = r.value.link('u-1');
      expect(res.success).toBe(false);
    });
  });

  describe('correct (SCD-1 in-place share update)', () => {
    it('updates share on an active row', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.correct(0.7);
      expect(res.success).toBe(true);
      expect(r.value.share).toBe(0.7);
    });

    it('rejects out-of-range share', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      expect(r.value.correct(-0.1).success).toBe(false);
      expect(r.value.correct(1.1).success).toBe(false);
    });

    it('rejects when row is inactive', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(new Date('2026-05-01'));
      const res = r.value.correct(0.8);
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
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      const d = new Date('2026-05-01');
      r.value.endEffect(d);
      expect(r.value.effectiveUntil).toEqual(d);
    });

    it('does not overwrite an already-ended row', () => {
      const r = PropertyAssetOwnership.createForUser('asset-1', 'u-1', 0.5);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.endEffect(new Date('2026-05-01'));
      r.value.endEffect(new Date('2026-06-01'));
      expect(r.value.effectiveUntil).toEqual(new Date('2026-05-01'));
    });
  });
});
