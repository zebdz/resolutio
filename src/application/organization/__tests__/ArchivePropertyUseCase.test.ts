import { describe, it, expect } from 'vitest';
import { ArchivePropertyUseCase } from '../ArchivePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

function mkProp(): OrganizationProperty {
  return OrganizationProperty.reconstitute({
    id: 'p-1',
    organizationId: 'org-1',
    name: 'A',
    address: null,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });
}

function mkAsset(id: string): PropertyAsset {
  return PropertyAsset.reconstitute({
    id,
    propertyId: 'p-1',
    name: `Apt ${id}`,
    size: 10,
    createdAt: new Date(),
    archivedAt: null,
  });
}

describe('ArchivePropertyUseCase', () => {
  it('archives property and cascade-archives non-archived assets', async () => {
    const p = mkProp();
    const assets = [mkAsset('a1'), mkAsset('a2')];
    const updatedAssets: string[] = [];
    let autoDenyCalled = false;

    const uc = new ArchivePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () => success(assets),
        updateAsset: async (a: PropertyAsset) => {
          updatedAssets.push(a.id);

          return success(undefined);
        },
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      autoDenyClaims: {
        executeForProperty: async () => {
          autoDenyCalled = true;
        },
      } as any,
    });

    const r = await uc.execute({ propertyId: 'p-1', adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(p.isArchived()).toBe(true);
    expect(updatedAssets.sort()).toEqual(['a1', 'a2']);
    expect(assets.every((a) => a.isArchived())).toBe(true);
    expect(autoDenyCalled).toBe(true);
  });
});
