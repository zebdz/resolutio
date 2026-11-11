/** Application boundary for authorized property changes. Raw request values are
 * parsed before domain behavior; persistence receives validated domain values. */
import { AssetId, UserId, OrganizationId } from '../../domain/shared/EntityIds';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
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

  async execute(
    input: UnarchiveAssetInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedId = AssetId.safeParse(input.assetId);

    if (!parsedId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }

    const aRes = await this.deps.assetRepository.findAssetById(parsedId.data);

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

    const actor = UserId.safeParse(input.adminUserId);

    if (
      !actor.success ||
      !(await this.authorize(actor.data, pRes.value.organizationId))
    ) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const u = asset.unarchive();

    if (!u.success) {
      return failure(u.error);
    }

    return this.deps.assetRepository.updateAsset(asset);
  }

  private async authorize(
    userId: UserId,
    orgId: OrganizationId
  ): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
