/** Asset behavior preserves supplied identity/time and rejects invalid units. */
import { describe, it, expect } from 'vitest';
import { PropertyAsset } from '../PropertyAsset';
import { AssetName, AssetSize } from '../PropertyValues';
import { AssetId, PropertyId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const at = Instant.parse('2026-01-01T00:00:00.000Z');

// Negative cases deliberately bypass brands to test runtime factory guards.
function createAsset(
  propertyId: string,
  name: string,
  size: number,
  checker?: ProfanityChecker
) {
  return PropertyAsset.create(
    PropertyId.parse(propertyId),
    name as AssetName,
    size as AssetSize,
    { id: AssetId.parse('asset-1'), now: at },
    checker
  );
}

const mockProfanityChecker: ProfanityChecker = {
  findProfaneWords: () => [],
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('PropertyAsset', () => {
  describe('create', () => {
    it('rejects non-finite sizes before creating an asset', () => {
      for (const size of [Infinity, -Infinity, NaN]) {
        expect(createAsset('prop-1', 'Apt', size).success).toBe(false);
      }
    });

    it('creates with a positive size', () => {
      const result = createAsset('prop-1', 'Apt #101', 75);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.propertyId).toBe('prop-1');
        expect(result.value.name).toBe('Apt #101');
        expect(result.value.size).toBe(75);
      }
    });

    it('rejects size = 0', () => {
      const result = createAsset('prop-1', 'Apt', 0);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE
        );
      }
    });

    it('rejects negative size', () => {
      const result = createAsset('prop-1', 'Apt', -10);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createAsset('prop-1', '', 75);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY
        );
      }
    });

    it('accepts fractional size', () => {
      const result = createAsset('prop-1', 'Lot', 12.5);
      expect(result.success).toBe(true);
    });

    it('rejects name with profanity', () => {
      const result = createAsset(
        'prop-1',
        'badword asset',
        10,
        mockProfanityChecker
      );
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('passes clean name with profanityChecker', () => {
      const result = createAsset(
        'prop-1',
        'Clean asset',
        10,
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('passes without profanityChecker (backward compat)', () => {
      const result = createAsset('prop-1', 'Any asset', 10);
      expect(result.success).toBe(true);
    });
  });

  describe('rename', () => {
    it('updates the name', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('Apt #101' as AssetName);
      expect(res.success).toBe(true);
      expect(r.value.name).toBe('Apt #101');
    });

    it('rejects empty name', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('  ' as AssetName);
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY
        );
      }
    });

    it('rejects profanity', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('badword' as AssetName, mockProfanityChecker);
      expect(res.success).toBe(false);
    });
  });

  describe('resize', () => {
    it('updates size when positive', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.resize(72 as AssetSize);
      expect(res.success).toBe(true);
      expect(r.value.size).toBe(72);
    });

    it('rejects zero and negative', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      expect(r.value.resize(0 as AssetSize).success).toBe(false);
      expect(r.value.resize(-1 as AssetSize).success).toBe(false);
    });
  });

  describe('archive / unarchive', () => {
    it('rejects double archive', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const a1 = r.value.archive(at);
      expect(a1.success).toBe(true);
      const a2 = r.value.archive(at);
      expect(a2.success).toBe(false);

      if (!a2.success) {
        expect(a2.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED
        );
      }
    });

    it('unarchives', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.archive(at);
      const u = r.value.unarchive();
      expect(u.success).toBe(true);
      expect(r.value.isArchived()).toBe(false);
    });

    it('rejects unarchive when not archived', () => {
      const r = createAsset('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const u = r.value.unarchive();
      expect(u.success).toBe(false);

      if (!u.success) {
        expect(u.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NOT_ARCHIVED
        );
      }
    });
  });
});
