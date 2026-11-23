/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import { PropertyId, AssetId } from '../../domain/shared/EntityIds';
import { ClaimDenialReason } from '../../domain/organization/PropertyValues';
import { Clock } from '../shared/EntityCreation';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';
import { success, failure, type Result } from '@/domain/shared/Result';
import type { OrganizationUseCaseFailure } from './OrganizationErrors';

export interface AutoDenyDependencies {
  clock: Clock;
  claimRepository: Pick<
    PropertyClaimRepository,
    'findPendingForAsset' | 'findPendingForAssets' | 'update'
  >;
  assetRepository: Pick<PropertyAssetRepository, 'findAssetsByProperty'>;
  notifyDenied: Pick<NotifyPropertyClaimDeniedUseCase, 'execute'>;
}

export class AutoDenyPendingClaimsOnArchiveUseCase {
  constructor(private deps: AutoDenyDependencies) {}

  async executeForAsset(input: {
    assetId: AssetId;
    systemReason: ClaimDenialReason;
  }): Promise<Result<void, OrganizationUseCaseFailure>> {
    const r = await this.deps.claimRepository.findPendingForAsset(
      input.assetId
    );

    if (!r.success) {
      return failure('common.errors.unexpected');
    }

    const now = this.deps.clock.now();

    for (const c of r.value) {
      const t = c.autoDeny(input.systemReason, now);

      if (t.success) {
        const saved = await this.deps.claimRepository.update(c);

        if (!saved.success) {
          return failure('common.errors.unexpected');
        }

        const delivered = await this.deps.notifyDenied.execute({
          claimId: c.id,
        });

        if (!delivered.success) {
          return failure('common.errors.unexpected');
        }
      }
    }

    return success(undefined);
  }

  async executeForProperty(input: {
    propertyId: PropertyId;
    systemReason: ClaimDenialReason;
  }): Promise<Result<void, OrganizationUseCaseFailure>> {
    // Find every non-archived or archived asset under this property.
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      input.propertyId,
      true
    );

    if (!assets.success) {
      return failure('common.errors.unexpected');
    }

    const assetIds = assets.value.map((a) => a.id);
    const pending =
      await this.deps.claimRepository.findPendingForAssets(assetIds);

    if (!pending.success) {
      return failure('common.errors.unexpected');
    }

    const now = this.deps.clock.now();

    for (const c of pending.value) {
      const t = c.autoDeny(input.systemReason, now);

      if (t.success) {
        const saved = await this.deps.claimRepository.update(c);

        if (!saved.success) {
          return failure('common.errors.unexpected');
        }

        const delivered = await this.deps.notifyDenied.execute({
          claimId: c.id,
        });

        if (!delivered.success) {
          return failure('common.errors.unexpected');
        }
      }
    }

    return success(undefined);
  }
}
