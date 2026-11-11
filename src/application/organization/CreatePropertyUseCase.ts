/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { SizeUnit } from '../../domain/organization/SizeUnit';
import {
  OrganizationId,
  PropertyId,
  UserId,
} from '../../domain/shared/EntityIds';
import {
  PropertyName,
  PropertyAddress,
} from '../../domain/organization/PropertyValues';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface CreatePropertyInput {
  organizationId: string;
  adminUserId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
}

export interface CreatePropertyDependencies {
  ids: IdGenerator;
  clock: Clock;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreatePropertyUseCase {
  constructor(private deps: CreatePropertyDependencies) {}

  async execute(
    input: CreatePropertyInput
  ): Promise<
    Result<{ property: OrganizationProperty }, OrganizationUseCaseFailure>
  > {
    const organizationId = OrganizationId.safeParse(input.organizationId);

    if (!organizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const adminUserId = UserId.safeParse(input.adminUserId);

    if (!adminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const isAuthorized = await this.authorize(
      adminUserId.data,
      organizationId.data
    );

    if (!isAuthorized) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const name = PropertyName.safeParse(input.name);

    if (!name.success) {
      return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
    }

    const sizeUnit = SizeUnit.parse(input.sizeUnit);

    if (!sizeUnit.success) {
      return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
    }

    if (input.address !== null && typeof input.address !== 'string') {
      return failure('common.errors.unexpected');
    }

    const address = input.address?.trim()
      ? PropertyAddress.parse(input.address)
      : null;
    const created = OrganizationProperty.create(
      organizationId.data,
      name.data,
      address,
      sizeUnit.value,
      entityCreation(PropertyId, this.deps.ids, this.deps.clock),
      this.deps.profanityChecker
    );

    if (!created.success) {
      return failure(created.error);
    }

    const saved = await this.deps.propertyRepository.save(created.value);

    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ property: saved.value });
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
