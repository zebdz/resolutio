import { describe, it, expect } from 'vitest';
import { PropertyClaim } from '../PropertyClaim';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const checker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

describe('PropertyClaim', () => {
  describe('submit', () => {
    it('creates a PENDING claim', () => {
      const r = PropertyClaim.submit('org-1', 'user-1', 'asset-1');
      expect(r.success).toBe(true);

      if (r.success) {
        expect(r.value.status).toBe('PENDING');
        expect(r.value.deniedReason).toBeNull();
        expect(r.value.decidedBy).toBeNull();
        expect(r.value.decidedAt).toBeNull();
      }
    });
  });

  describe('approve', () => {
    it('transitions PENDING → APPROVED and stores admin + timestamp', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const at = new Date('2026-05-01T10:00:00Z');
      const res = r.value.approve('admin-1', at);
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('APPROVED');
      expect(r.value.decidedBy).toBe('admin-1');
      expect(r.value.decidedAt).toEqual(at);
    });

    it('rejects when not pending', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.approve('admin-1', new Date());
      const res = r.value.approve('admin-2', new Date());
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_CLAIM_NOT_PENDING
        );
      }
    });
  });

  describe('deny', () => {
    it('transitions PENDING → DENIED with reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny('admin-1', 'Cannot verify', new Date());
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('Cannot verify');
    });

    it('rejects empty reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny('admin-1', '   ', new Date());
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
        );
      }
    });

    it('rejects profane reason', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny(
        'admin-1',
        'badword reason',
        new Date(),
        checker
      );
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('rejects deny when not pending', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.approve('admin-1', new Date());
      const res = r.value.deny('admin-2', 'no', new Date());
      expect(res.success).toBe(false);
    });
  });

  describe('autoDeny', () => {
    it('transitions PENDING → DENIED without admin', () => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.autoDeny('asset archived', new Date());
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('asset archived');
      expect(r.value.decidedBy).toBeNull();
    });
  });
});
