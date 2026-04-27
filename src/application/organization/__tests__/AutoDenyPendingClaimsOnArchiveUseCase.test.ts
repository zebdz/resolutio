import { describe, it, expect } from 'vitest';
import { AutoDenyPendingClaimsOnArchiveUseCase } from '../AutoDenyPendingClaimsOnArchiveUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success } from '../../../domain/shared/Result';

describe('AutoDenyPendingClaimsOnArchiveUseCase', () => {
  it('denies every pending claim for an asset and notifies each', async () => {
    const c1 = (() => {
      const r = PropertyClaim.submit('o', 'u1', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const c2 = (() => {
      const r = PropertyClaim.submit('o', 'u2', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      claimRepository: {
        findPendingForAsset: async () => success([c1, c2]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {} as any,
      notifyDenied: {
        execute: async (input: any) => {
          notified.push(input.claimId);
        },
      } as any,
    });
    await uc.executeForAsset({ assetId: 'a-1', systemReason: 'archived' });
    expect(c1.status).toBe('DENIED');
    expect(c2.status).toBe('DENIED');
    expect(notified.length).toBe(2);
  });

  it('denies across all assets in a property', async () => {
    const c1 = (() => {
      const r = PropertyClaim.submit('o', 'u1', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      claimRepository: {
        findPendingForAssets: async () => success([c1]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () =>
          success([
            PropertyAsset.reconstitute({
              id: 'a-1',
              propertyId: 'p-1',
              name: 'X',
              size: 1,
              createdAt: new Date(),
              archivedAt: null,
            }),
          ]),
      } as any,
      notifyDenied: {
        execute: async (input: any) => {
          notified.push(input.claimId);
        },
      } as any,
    });
    await uc.executeForProperty({
      propertyId: 'p-1',
      systemReason: 'archived',
    });
    expect(c1.status).toBe('DENIED');
    expect(notified.length).toBe(1);
  });
});
