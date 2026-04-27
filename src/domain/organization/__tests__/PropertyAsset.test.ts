import { describe, it, expect } from 'vitest';
import { PropertyAsset } from '../PropertyAsset';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const mockProfanityChecker: ProfanityChecker = {
  containsProfanity: (text: string) => text.includes('badword'),
};

describe('PropertyAsset', () => {
  describe('create', () => {
    it('creates with a positive size', () => {
      const result = PropertyAsset.create('prop-1', 'Apt #101', 75);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.propertyId).toBe('prop-1');
        expect(result.value.name).toBe('Apt #101');
        expect(result.value.size).toBe(75);
      }
    });

    it('rejects size = 0', () => {
      const result = PropertyAsset.create('prop-1', 'Apt', 0);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE
        );
      }
    });

    it('rejects negative size', () => {
      const result = PropertyAsset.create('prop-1', 'Apt', -10);
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = PropertyAsset.create('prop-1', '', 75);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY
        );
      }
    });

    it('accepts fractional size', () => {
      const result = PropertyAsset.create('prop-1', 'Lot', 12.5);
      expect(result.success).toBe(true);
    });

    it('rejects name with profanity', () => {
      const result = PropertyAsset.create(
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
      const result = PropertyAsset.create(
        'prop-1',
        'Clean asset',
        10,
        mockProfanityChecker
      );
      expect(result.success).toBe(true);
    });

    it('passes without profanityChecker (backward compat)', () => {
      const result = PropertyAsset.create('prop-1', 'Any asset', 10);
      expect(result.success).toBe(true);
    });
  });

  describe('rename', () => {
    it('updates the name', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('Apt #101');
      expect(res.success).toBe(true);
      expect(r.value.name).toBe('Apt #101');
    });

    it('rejects empty name', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('  ');
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY
        );
      }
    });

    it('rejects profanity', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('badword', mockProfanityChecker);
      expect(res.success).toBe(false);
    });
  });

  describe('resize', () => {
    it('updates size when positive', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.resize(72);
      expect(res.success).toBe(true);
      expect(r.value.size).toBe(72);
    });

    it('rejects zero and negative', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      expect(r.value.resize(0).success).toBe(false);
      expect(r.value.resize(-1).success).toBe(false);
    });
  });

  describe('archive / unarchive', () => {
    it('rejects double archive', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      const a1 = r.value.archive();
      expect(a1.success).toBe(true);
      const a2 = r.value.archive();
      expect(a2.success).toBe(false);

      if (!a2.success) {
        expect(a2.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED
        );
      }
    });

    it('unarchives', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.archive();
      const u = r.value.unarchive();
      expect(u.success).toBe(true);
      expect(r.value.isArchived()).toBe(false);
    });

    it('rejects unarchive when not archived', () => {
      const r = PropertyAsset.create('prop-1', 'Apt', 50);

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
