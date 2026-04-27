import { describe, it, expect } from 'vitest';
import { DenyPropertyClaimUseCase } from '../DenyPropertyClaimUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const claim = (() => {
  const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

  if (!r.success) {
    throw new Error('setup');
  }

  return r.value;
})();

describe('DenyPropertyClaimUseCase', () => {
  it('denies with reason and notifies', async () => {
    let notified = 0;
    const uc = new DenyPropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(claim),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
      notifyDenied: {
        execute: async () => {
          notified++;
        },
      } as any,
    });
    const r = await uc.execute({
      claimId: claim.id,
      adminUserId: 'admin',
      reason: 'Cannot verify',
    });
    expect(r.success).toBe(true);
    expect(claim.status).toBe('DENIED');
    expect(notified).toBe(1);
  });

  it('rejects empty reason', async () => {
    const fresh = (() => {
      const r = PropertyClaim.submit('org-1', 'u-1', 'a-1');

      if (!r.success) {
        throw new Error('setup');
      }

      return r.value;
    })();
    const uc = new DenyPropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(fresh),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
      notifyDenied: { execute: async () => {} } as any,
    });
    const r = await uc.execute({
      claimId: fresh.id,
      adminUserId: 'admin',
      reason: ' ',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }
  });
});
