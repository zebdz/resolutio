import { describe, it, expect } from 'vitest';
import { OrganizationProperty } from '../OrganizationProperty';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const cleanChecker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

describe('OrganizationProperty', () => {
  describe('create', () => {
    it('creates with name, address, sizeUnit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Building A',
        '1 Main St',
        'SQUARE_METERS'
      );
      expect(r.success).toBe(true);

      if (r.success) {
        expect(r.value.organizationId).toBe('org-1');
        expect(r.value.name).toBe('Building A');
        expect(r.value.address).toBe('1 Main St');
        expect(r.value.sizeUnit).toBe('SQUARE_METERS');
        expect(r.value.archivedAt).toBeNull();
      }
    });

    it('rejects empty name', () => {
      const r = OrganizationProperty.create('org-1', '', null, 'SQUARE_METERS');
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
      }
    });

    it('rejects invalid sizeUnit', () => {
      const r = OrganizationProperty.create('org-1', 'Bldg', null, 'FURLONGS');
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
      }
    });

    it('rejects profane name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'badword tower',
        null,
        'SQUARE_METERS',
        cleanChecker
      );
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });
  });

  describe('rename', () => {
    it('updates the name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('New');
      expect(res.success).toBe(true);
      expect(r.value.name).toBe('New');
    });

    it('rejects empty name', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('');
      expect(res.success).toBe(false);
    });

    it('rejects profane name when checker given', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Old',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.rename('badword', cleanChecker);
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });
  });

  describe('updateAddress', () => {
    it('accepts null (clears address)', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        '1 St',
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.updateAddress(null);
      expect(res.success).toBe(true);
      expect(r.value.address).toBeNull();
    });

    it('sets a non-empty address', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.updateAddress('2 St');
      expect(res.success).toBe(true);
      expect(r.value.address).toBe('2 St');
    });
  });

  describe('updateSizeUnit', () => {
    it('accepts a valid unit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.updateSizeUnit('UNIT_COUNT');
      expect(res.success).toBe(true);
      expect(r.value.sizeUnit).toBe('UNIT_COUNT');
    });

    it('rejects invalid unit', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'Bldg',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.updateSizeUnit('FURLONGS');
      expect(res.success).toBe(false);
    });
  });

  describe('archive/unarchive', () => {
    it('archives then unarchives', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const a = r.value.archive();
      expect(a.success).toBe(true);
      expect(r.value.isArchived()).toBe(true);
      const u = r.value.unarchive();
      expect(u.success).toBe(true);
      expect(r.value.isArchived()).toBe(false);
    });

    it('rejects archive when already archived', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.archive();
      const a = r.value.archive();
      expect(a.success).toBe(false);

      if (!a.success) {
        expect(a.error).toBe(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
      }
    });

    it('rejects unarchive when not archived', () => {
      const r = OrganizationProperty.create(
        'org-1',
        'B',
        null,
        'SQUARE_METERS'
      );

      if (!r.success) {
        throw new Error('setup');
      }

      const u = r.value.unarchive();
      expect(u.success).toBe(false);
    });
  });
});
