import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface AutoDenyDependencies {
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class AutoDenyPendingClaimsOnArchiveUseCase {
  constructor(private deps: AutoDenyDependencies) {}

  async executeForAsset(input: {
    assetId: string;
    systemReason: string;
  }): Promise<void> {
    const r = await this.deps.claimRepository.findPendingForAsset(
      input.assetId
    );

    if (!r.success) {
      return;
    }

    const now = new Date();

    for (const c of r.value) {
      const t = c.autoDeny(input.systemReason, now);

      if (t.success) {
        await this.deps.claimRepository.update(c);
        await this.deps.notifyDenied.execute({ claimId: c.id });
      }
    }
  }

  async executeForProperty(input: {
    propertyId: string;
    systemReason: string;
  }): Promise<void> {
    // Find every non-archived or archived asset under this property.
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      input.propertyId,
      true
    );

    if (!assets.success) {
      return;
    }

    const assetIds = assets.value.map((a) => a.id);
    const pending =
      await this.deps.claimRepository.findPendingForAssets(assetIds);

    if (!pending.success) {
      return;
    }

    const now = new Date();

    for (const c of pending.value) {
      const t = c.autoDeny(input.systemReason, now);

      if (t.success) {
        await this.deps.claimRepository.update(c);
        await this.deps.notifyDenied.execute({ claimId: c.id });
      }
    }
  }
}
