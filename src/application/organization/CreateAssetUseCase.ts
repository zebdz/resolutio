import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface CreateAssetInput {
  propertyId: string;
  adminUserId: string;
  name: string;
  size: number;
}

export interface CreateAssetDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreateAssetUseCase {
  constructor(private deps: CreateAssetDependencies) {}

  async execute(
    input: CreateAssetInput
  ): Promise<Result<{ asset: PropertyAsset }, string>> {
    const propRes = await this.deps.propertyRepository.findById(
      input.propertyId
    );

    if (!propRes.success) {
      return failure(propRes.error);
    }

    if (!propRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = propRes.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const created = PropertyAsset.create(
      input.propertyId,
      input.name,
      input.size,
      this.deps.profanityChecker
    );

    if (!created.success) {
      return failure(created.error);
    }

    const saved = await this.deps.assetRepository.saveAsset(created.value);

    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ asset: saved.value });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
