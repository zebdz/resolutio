import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UnarchiveAssetInput {
  assetId: string;
  adminUserId: string;
}

export interface UnarchiveAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UnarchiveAssetUseCase {
  constructor(private deps: UnarchiveAssetDependencies) {}

  async execute(input: UnarchiveAssetInput): Promise<Result<void, string>> {
    const aRes = await this.deps.assetRepository.findAssetById(input.assetId);

    if (!aRes.success) {
      return failure(aRes.error);
    }

    if (!aRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }

    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);

    if (!pRes.success || !pRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    if (!(await this.authorize(input.adminUserId, pRes.value.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const u = asset.unarchive();

    if (!u.success) {
      return failure(u.error);
    }

    return this.deps.assetRepository.updateAsset(asset);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
