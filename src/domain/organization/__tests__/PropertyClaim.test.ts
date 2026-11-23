/** Claim lifecycle tests reject impossible persisted decisions and use explicit
 * creation identities/timestamps for deterministic domain transitions. */
import {
  OrganizationId,
  UserId,
  AssetId,
  PropertyClaimId,
} from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { ClaimDenialReason } from '../PropertyValues';
const at = Instant.parse('2026-01-01T00:00:00.000Z');

function submitClaim(organizationId: string, userId: string, assetId: string) {
  return PropertyClaim.submit(
    OrganizationId.parse(organizationId),
    UserId.parse(userId),
    AssetId.parse(assetId),
    { id: PropertyClaimId.parse('claim-1'), now: at }
  );
}

import { describe, it, expect } from 'vitest';
import { PropertyClaim } from '../PropertyClaim';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';
import { SharedDomainCodes } from '../../shared/SharedDomainCodes';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';

const checker: ProfanityChecker = {
  findProfaneWords: () => [],
  containsProfanity: (t) => t.includes('badword'),
};

describe('PropertyClaim', () => {
  it.each([
    {
      status: 'APPROVED',
      deniedReason: null,
      decidedBy: null,
      decidedAt: null,
    },
    {
      status: 'PENDING',
      deniedReason: null,
      decidedBy: 'admin',
      decidedAt: new Date(at),
    },
    {
      status: 'DENIED',
      deniedReason: null,
      decidedBy: null,
      decidedAt: new Date(at),
    },
    { status: 'UNKNOWN', deniedReason: null, decidedBy: null, decidedAt: null },
  ])('rejects impossible persisted decision columns: %j', (decision) => {
    expect(() =>
      PropertyClaim.reconstitute({
        id: 'claim-1',
        organizationId: 'org-1',
        userId: 'user-1',
        assetId: 'asset-1',
        ...decision,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    ).toThrow();
  });
  describe('submit', () => {
    it('creates a PENDING claim', () => {
      const r = submitClaim('org-1', 'user-1', 'asset-1');
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
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const at = new Date('2026-05-01T10:00:00Z');
      const res = r.value.approve(
        UserId.parse('admin-1'),
        Instant.fromDate(at)
      );
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('APPROVED');
      expect(r.value.decidedBy).toBe('admin-1');
      expect(r.value.decidedAt).toEqual(at);
    });

    it('rejects when not pending', () => {
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.approve(UserId.parse('admin-1'), at);
      const res = r.value.approve(UserId.parse('admin-2'), at);
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
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny(
        UserId.parse('admin-1'),
        ClaimDenialReason.parse('Cannot verify'),
        at
      );
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('Cannot verify');
    });

    it('rejects empty reason', () => {
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny(
        UserId.parse('admin-1'),
        '   ' as ClaimDenialReason,
        at
      );
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(
          OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
        );
      }
    });

    it('rejects profane reason', () => {
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.deny(
        UserId.parse('admin-1'),
        ClaimDenialReason.parse('badword reason'),
        at,
        checker
      );
      expect(res.success).toBe(false);

      if (!res.success) {
        expect(res.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
      }
    });

    it('rejects deny when not pending', () => {
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      r.value.approve(UserId.parse('admin-1'), at);
      const res = r.value.deny(
        UserId.parse('admin-2'),
        ClaimDenialReason.parse('no'),
        at
      );
      expect(res.success).toBe(false);
    });
  });

  describe('autoDeny', () => {
    it('transitions PENDING → DENIED without admin', () => {
      const r = submitClaim('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      const res = r.value.autoDeny(
        ClaimDenialReason.parse('asset archived'),
        at
      );
      expect(res.success).toBe(true);
      expect(r.value.status).toBe('DENIED');
      expect(r.value.deniedReason).toBe('asset archived');
      expect(r.value.decidedBy).toBeNull();
    });
  });
});
