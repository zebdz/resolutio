import { describe, it, expect } from 'vitest';
import { UnarchiveAssetUseCase } from '../UnarchiveAssetUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('UnarchiveAssetUseCase', () => {
  it('unarchives an archived asset', async () => {
    const prop = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: null,
    });
    const asset = PropertyAsset.reconstitute({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'X',
      size: 10,
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const uc = new UnarchiveAssetUseCase({
      assetRepository: {
        findAssetById: async () => success(asset),
        updateAsset: async () => success(undefined),
      } as any,
      propertyRepository: { findById: async () => success(prop) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ assetId: 'a-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(asset.isArchived()).toBe(false);
  });
});
