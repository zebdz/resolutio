/** Application boundary for authorized property changes. Raw request values are
 * parsed before domain behavior; persistence receives validated domain values. */
import { AssetName, AssetSize } from '../../domain/organization/PropertyValues';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import {
  AssetId,
  PropertyId,
  UserId,
  OrganizationId,
} from '../../domain/shared/EntityIds';
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface CreateAssetInput {
  propertyId: string;
  adminUserId: string;
  name: string;
  size: number;
}

export interface CreateAssetDependencies {
  ids: IdGenerator;
  clock: Clock;
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
  ): Promise<Result<{ asset: PropertyAsset }, OrganizationUseCaseFailure>> {
    const parsedId = PropertyId.safeParse(input.propertyId);

    if (!parsedId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const propRes = await this.deps.propertyRepository.findById(parsedId.data);

    if (!propRes.success) {
      return failure(propRes.error);
    }

    if (!propRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = propRes.value;

    const actor = UserId.safeParse(input.adminUserId);

    if (
      !actor.success ||
      !(await this.authorize(actor.data, property.organizationId))
    ) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const name = AssetName.safeParse(input.name);

    if (!name.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NAME_EMPTY);
    }

    const size = AssetSize.safeParse(input.size);

    if (!size.success) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_SIZE_NON_POSITIVE);
    }

    const created = PropertyAsset.create(
      parsedId.data,
      name.data,
      size.data,
      entityCreation(AssetId, this.deps.ids, this.deps.clock),
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
