import { describe, it, expect } from 'vitest';
import { ReplaceAssetOwnersUseCase } from '../ReplaceAssetOwnersUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { OrganizationErrors } from '../OrganizationErrors';
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
const asset = PropertyAsset.reconstitute({
  id: 'a-1',
  propertyId: 'p-1',
  name: 'Apt',
  size: 50,
  createdAt: new Date(),
  archivedAt: null,
});

function mkDeps(overrides: Partial<{ isAdmin: boolean }> = {}) {
  const cfg = { isAdmin: true, ...overrides };
  const calls: any[] = [];
  const deps = {
    assetRepository: {
      findAssetById: async () => success(asset),
      replaceOwners: async (input: any) => {
        calls.push(input);

        return success(undefined);
      },
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserAdmin: async () => cfg.isAdmin } as any,
    userRepository: { isSuperAdmin: async () => false } as any,
  };

  return { deps, calls };
}

describe('ReplaceAssetOwnersUseCase', () => {
  it('accepts rows summing to exactly 1', async () => {
    const { deps, calls } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [
        { kind: 'user', userId: 'u-1', share: 0.5 },
        { kind: 'user', userId: 'u-2', share: 0.5 },
      ],
    });
    expect(r.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].inserts.length).toBe(2);
  });

  it('accepts an empty owners list (asset becomes ownerless)', async () => {
    const { deps, calls } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [],
    });
    expect(r.success).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].inserts).toEqual([]);
  });

  it('rejects sum != 1 (within tolerance 1e-6)', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'user', userId: 'u-1', share: 0.5 }],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }
  });

  it('rejects out-of-range share', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'user', userId: 'u-1', share: 1.2 }],
    });
    expect(r.success).toBe(false);
  });

  it('rejects external owner with empty label', async () => {
    const { deps } = mkDeps();
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'admin',
      owners: [{ kind: 'external', label: '  ', share: 1 }],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.EXTERNAL_OWNER_LABEL_EMPTY);
    }
  });

  it('rejects non-admin caller', async () => {
    const { deps } = mkDeps({ isAdmin: false });
    const uc = new ReplaceAssetOwnersUseCase(deps);
    const r = await uc.execute({
      assetId: 'a-1',
      adminUserId: 'u',
      owners: [{ kind: 'user', userId: 'u-1', share: 1 }],
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  describe('zero-share rejection', () => {
    it('rejects a row with share = 0 (pointless — contributes nothing)', async () => {
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'user', userId: 'u-1', share: 1.0 },
          { kind: 'user', userId: 'u-2', share: 0 }, // zero share
        ],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.OWNERSHIP_SHARE_MUST_BE_POSITIVE
        );
      }
    });

    it('rejects an external-owner row with share = 0', async () => {
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'user', userId: 'u-1', share: 1.0 },
          { kind: 'external', label: 'Record owner', share: 0 },
        ],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.OWNERSHIP_SHARE_MUST_BE_POSITIVE
        );
      }
    });
  });

  describe('duplicate owner rejection', () => {
    it('rejects two user rows with the same userId', async () => {
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'user', userId: 'u-1', share: 0.5 },
          { kind: 'user', userId: 'u-1', share: 0.5 }, // duplicate
        ],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }
    });

    it('rejects two external-owner rows with the same label', async () => {
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'external', label: 'Record owner', share: 0.5 },
          { kind: 'external', label: 'Record owner', share: 0.5 }, // duplicate
        ],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }
    });

    it('treats label duplicates case-insensitively and ignores surrounding whitespace', async () => {
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'external', label: 'Record Owner', share: 0.5 },
          { kind: 'external', label: '  record owner ', share: 0.5 },
        ],
      });
      expect(r.success).toBe(false);
    });

    it('allows a user row and an external-owner row that happen to share a string value', async () => {
      // userId = 'foo' and external label = 'foo' must not collide.
      const { deps } = mkDeps();
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [
          { kind: 'user', userId: 'foo', share: 0.5 },
          { kind: 'external', label: 'foo', share: 0.5 },
        ],
      });
      expect(r.success).toBe(true);
    });
  });

  describe('archived guards', () => {
    it('rejects when the asset is archived', async () => {
      const archivedAsset = PropertyAsset.reconstitute({
        id: 'a-1',
        propertyId: 'p-1',
        name: 'Archived',
        size: 50,
        createdAt: new Date(),
        archivedAt: new Date(),
      });
      const { deps } = mkDeps();
      deps.assetRepository.findAssetById = async () => success(archivedAsset);
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [{ kind: 'user', userId: 'u-1', share: 1 }],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED
        );
      }
    });

    it("rejects when the property is archived (cascade-archived asset shouldn't even reach this branch, but property check is independent)", async () => {
      const archivedProp = OrganizationProperty.reconstitute({
        id: 'p-1',
        organizationId: 'org-1',
        name: 'A',
        address: null,
        sizeUnit: 'SQUARE_METERS',
        createdAt: new Date(),
        archivedAt: new Date(),
      });
      const { deps } = mkDeps();
      deps.propertyRepository.findById = async () => success(archivedProp);
      const uc = new ReplaceAssetOwnersUseCase(deps);
      const r = await uc.execute({
        assetId: 'a-1',
        adminUserId: 'admin',
        owners: [{ kind: 'user', userId: 'u-1', share: 1 }],
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
      }
    });
  });
});
