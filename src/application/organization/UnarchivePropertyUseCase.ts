import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UnarchivePropertyInput {
  propertyId: string;
  adminUserId: string;
}

export interface UnarchivePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UnarchivePropertyUseCase {
  constructor(private deps: UnarchivePropertyDependencies) {}

  async execute(input: UnarchivePropertyInput): Promise<Result<void, string>> {
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

    const u = property.unarchive();

    if (!u.success) {
      return failure(u.error);
    }

    const saved = await this.deps.propertyRepository.update(property);

    if (!saved.success) {
      return failure(saved.error);
    }

    // Cascade-unarchive every asset whose archived_at equals the property's previous archive time.
    // Simpler policy: unarchive every archived asset in the property (admins can re-archive if needed).
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      property.id,
      true
    );

    if (assets.success) {
      for (const a of assets.value) {
        if (a.isArchived()) {
          const r = a.unarchive();

          if (r.success) {
            await this.deps.assetRepository.updateAsset(a);
          }
        }
      }
    }

    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
