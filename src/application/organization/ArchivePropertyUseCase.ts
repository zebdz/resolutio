import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { AutoDenyPendingClaimsOnArchiveUseCase } from './AutoDenyPendingClaimsOnArchiveUseCase';

export interface ArchivePropertyInput {
  propertyId: string;
  adminUserId: string;
}

export interface ArchivePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  autoDenyClaims: AutoDenyPendingClaimsOnArchiveUseCase;
}

export class ArchivePropertyUseCase {
  constructor(private deps: ArchivePropertyDependencies) {}

  async execute(input: ArchivePropertyInput): Promise<Result<void, string>> {
    const found = await this.deps.propertyRepository.findById(input.propertyId);

    if (!found.success) {
      return failure(found.error);
    }

    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = found.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const arch = property.archive();

    if (!arch.success) {
      return failure(arch.error);
    }

    const saved = await this.deps.propertyRepository.update(property);

    if (!saved.success) {
      return failure(saved.error);
    }

    // Cascade-archive non-archived assets (archived_at only — ownership untouched).
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      property.id,
      false
    );

    if (assets.success) {
      for (const a of assets.value) {
        const r = a.archive();

        if (r.success) {
          await this.deps.assetRepository.updateAsset(a);
        }
      }
    }

    // Auto-deny any pending claims on assets in this property.
    await this.deps.autoDenyClaims.executeForProperty({
      propertyId: property.id,
      systemReason: 'property archived',
    });

    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
