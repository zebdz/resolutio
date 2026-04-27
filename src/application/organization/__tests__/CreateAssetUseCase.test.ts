import { describe, it, expect } from 'vitest';
import { CreateAssetUseCase } from '../CreateAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
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

describe('CreateAssetUseCase', () => {
  it('creates asset under property', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: {
        findById: async () => success(prop),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'Apt',
      size: 50,
    });
    expect(r.success).toBe(true);
  });

  it('rejects size 0', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'A',
      size: 0,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE
      );
    }
  });

  it('rejects non-admin', async () => {
    const uc = new CreateAssetUseCase({
      assetRepository: {
        saveAsset: async (a: PropertyAsset) => success(a),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'u',
      name: 'A',
      size: 1,
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
