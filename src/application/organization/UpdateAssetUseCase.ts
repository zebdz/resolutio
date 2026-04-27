import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface UpdateAssetInput {
  assetId: string;
  adminUserId: string;
  name?: string;
  size?: number;
}

export interface UpdateAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdateAssetUseCase {
  constructor(private deps: UpdateAssetDependencies) {}

  async execute(input: UpdateAssetInput): Promise<Result<void, string>> {
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

    if (input.name !== undefined) {
      const r = asset.rename(input.name, this.deps.profanityChecker);

      if (!r.success) {
        return failure(r.error);
      }
    }

    if (input.size !== undefined) {
      const r = asset.resize(input.size);

      if (!r.success) {
        return failure(r.error);
      }
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
