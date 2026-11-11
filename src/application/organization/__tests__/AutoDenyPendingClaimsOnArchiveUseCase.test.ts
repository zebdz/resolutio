/** Property/claim boundary regressions exercise authorized flows with explicit
 * creation inputs while keeping raw persistence fixtures distinct from domain values. */
import {
  propertyTestCreation,
  propertyTestInstant,
  submitTestClaim,
} from './propertyTestValues';
import { UserId, AssetId, PropertyId } from '../../../domain/shared/EntityIds';
import { Instant } from '../../../domain/shared/Instant';
import { ClaimDenialReason } from '../../../domain/organization/PropertyValues';
import { describe, it, expect, vi } from 'vitest';
import { AutoDenyPendingClaimsOnArchiveUseCase } from '../AutoDenyPendingClaimsOnArchiveUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { success, failure } from '../../../domain/shared/Result';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';

describe('AutoDenyPendingClaimsOnArchiveUseCase', () => {
  it.each(['persist', 'notify'])(
    'propagates an unavailable %s step explicitly',
    async (step) => {
      const claim = expectSuccess(submitTestClaim('o', 'u1', 'a-1'));
      const notify = vi
        .fn()
        .mockResolvedValue(failure('common.errors.unexpected'));
      const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
        ...propertyTestCreation(),
        claimRepository: {
          findPendingForAsset: async () => success([claim]),
          findPendingForAssets: async () => success([]),
          update: async () =>
            step === 'persist'
              ? failure('common.errors.unexpected')
              : success(undefined),
        },
        assetRepository: { findAssetsByProperty: async () => success([]) },
        notifyDenied: { execute: notify },
      });
      expect(
        await uc.executeForAsset({
          assetId: AssetId.parse('a-1'),
          systemReason: ClaimDenialReason.parse('archived'),
        })
      ).toEqual(failure('common.errors.unexpected'));

      if (step === 'persist') {
        expect(notify).not.toHaveBeenCalled();
      }
    }
  );
  it('denies every pending claim for an asset and notifies each', async () => {
    const c1 = (() => {
      const r = submitTestClaim('o', 'u1', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const c2 = (() => {
      const r = submitTestClaim('o', 'u2', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      ...propertyTestCreation(),
      claimRepository: {
        findPendingForAsset: async () => success([c1, c2]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {} as any,
      notifyDenied: {
        execute: async (input: any) => {
          notified.push(input.claimId);

          return success(undefined);
        },
      } as any,
    });
    await uc.executeForAsset({
      assetId: AssetId.parse('a-1'),
      systemReason: ClaimDenialReason.parse('archived'),
    });
    expect(c1.status).toBe('DENIED');
    expect(c2.status).toBe('DENIED');
    expect(notified.length).toBe(2);
  });

  it('denies across all assets in a property', async () => {
    const c1 = (() => {
      const r = submitTestClaim('o', 'u1', 'a-1');

      if (!r.success) {
        throw new Error('s');
      }

      return r.value;
    })();
    const notified: string[] = [];
    const uc = new AutoDenyPendingClaimsOnArchiveUseCase({
      ...propertyTestCreation(),
      claimRepository: {
        findPendingForAssets: async () => success([c1]),
        update: async () => success(undefined),
      } as any,
      assetRepository: {
        findAssetsByProperty: async () =>
          success([
            PropertyAsset.reconstitute({
              id: 'a-1',
              propertyId: PropertyId.parse('p-1'),
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

          return success(undefined);
        },
      } as any,
    });
    await uc.executeForProperty({
      propertyId: PropertyId.parse('p-1'),
      systemReason: ClaimDenialReason.parse('archived'),
    });
    expect(c1.status).toBe('DENIED');
    expect(notified.length).toBe(1);
  });
});
