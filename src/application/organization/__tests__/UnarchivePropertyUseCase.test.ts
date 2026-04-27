import { describe, it, expect } from 'vitest';
import { UnarchivePropertyUseCase } from '../UnarchivePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('UnarchivePropertyUseCase', () => {
  it('unarchives property and every archived asset within it', async () => {
    const p = OrganizationProperty.reconstitute({
      id: 'p-1',
      organizationId: 'org-1',
      name: 'A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const a1 = PropertyAsset.reconstitute({
      id: 'a1',
      propertyId: 'p-1',
      name: 'X',
      size: 1,
      createdAt: new Date(),
      archivedAt: new Date(),
    });
    const a2 = PropertyAsset.reconstitute({
      id: 'a2',
      propertyId: 'p-1',
      name: 'Y',
      size: 1,
      createdAt: new Date(),
      archivedAt: null,
    });

    const updated: string[] = [];
    const uc = new UnarchivePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () => success([a1, a2]),
        updateAsset: async (a: PropertyAsset) => {
          updated.push(a.id);

          return success(undefined);
        },
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });

    const r = await uc.execute({ propertyId: 'p-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(p.isArchived()).toBe(false);
    expect(updated).toEqual(['a1']);
    expect(a1.isArchived()).toBe(false);
    expect(a2.isArchived()).toBe(false);
  });
});
