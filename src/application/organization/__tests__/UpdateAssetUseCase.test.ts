import { describe, it, expect } from 'vitest';
import { UpdateAssetUseCase } from '../UpdateAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
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

describe('UpdateAssetUseCase', () => {
  it('renames and resizes', async () => {
    const a = PropertyAsset.reconstitute({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'X',
      size: 10,
      createdAt: new Date(),
      archivedAt: null,
    });
    const uc = new UpdateAssetUseCase({
      assetRepository: {
        findAssetById: async () => success(a),
        updateAsset: async () => success(undefined),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      name: 'Y',
      size: 20,
    });
    expect(r.success).toBe(true);
    expect(a.name).toBe('Y');
    expect(a.size).toBe(20);
  });
});
