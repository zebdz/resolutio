import { describe, it, expect } from 'vitest';
import { ListClaimableAssetsUseCase } from '../ListClaimableAssetsUseCase';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});

// Default no-op claim repo — most tests don't care about my-claims filtering;
// they just need the dependency to satisfy the new constructor shape.
const emptyClaimRepo = {
  findMyClaimsForProperty: async () => success([]),
} as any;

describe('ListClaimableAssetsUseCase', () => {
  it('returns only {id, name} — no user_id / label / share leaks', async () => {
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(prop) } as any,
      assetRepository: {
        findClaimableAssets: async () =>
          success([
            { id: 'a-1', name: 'Apt #101' },
            { id: 'a-2', name: 'Apt #102' },
          ]),
      } as any,
      organizationRepository: { isUserMember: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      claimRepository: emptyClaimRepo,
    });
    const r = await uc.execute({
      userId: 'u',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(true);

    if (r.success) {
      for (const a of r.value) {
        expect(Object.keys(a).sort()).toEqual(['id', 'name']);
      }
    }
  });

  it('excludes assets where the calling user already has a PENDING claim', async () => {
    // Otherwise the user sees the same asset they just claimed and clicks
    // Claim again → backend rejects with ALREADY_PENDING_FOR_ASSET. Better
    // to hide it from the list entirely so the button never appears.
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(prop) } as any,
      assetRepository: {
        findClaimableAssets: async () =>
          success([
            { id: 'a-1', name: 'Apt #101' },
            { id: 'a-2', name: 'Apt #102' },
          ]),
      } as any,
      organizationRepository: { isUserMember: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      claimRepository: {
        findMyClaimsForProperty: async () =>
          success([
            // Pending → must be filtered out.
            {
              claim: { assetId: 'a-1', status: 'PENDING' },
              assetName: 'Apt #101',
            },
            // Denied → user is allowed to see + re-claim (after cooldown).
            {
              claim: { assetId: 'a-2', status: 'DENIED' },
              assetName: 'Apt #102',
            },
          ]),
      } as any,
    });
    const r = await uc.execute({
      userId: 'u',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(true);

    if (!r.success) {
      return;
    }

    expect(r.value.map((a) => a.id)).toEqual(['a-2']);
  });

  it('rejects non-member caller', async () => {
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(prop) } as any,
      assetRepository: {
        findClaimableAssets: async () => success([]),
      } as any,
      organizationRepository: { isUserMember: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      claimRepository: emptyClaimRepo,
    });
    const r = await uc.execute({
      userId: 'x',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }
  });

  it('rejects when property belongs to a different org', async () => {
    const other = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-OTHER',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: null,
    });
    const uc = new ListClaimableAssetsUseCase({
      propertyRepository: { findById: async () => success(other) } as any,
      assetRepository: {
        findClaimableAssets: async () => success([]),
      } as any,
      organizationRepository: { isUserMember: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      claimRepository: emptyClaimRepo,
    });
    const r = await uc.execute({
      userId: 'u',
      organizationId: 'org-1',
      propertyId: 'p-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
  });
});
