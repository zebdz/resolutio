/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
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

export interface UpdatePropertyInput {
  propertyId: string;
  adminUserId: string;
  name?: string;
  address?: string | null;
  sizeUnit?: string;
}

export interface UpdatePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class UpdatePropertyUseCase {
  constructor(private deps: UpdatePropertyDependencies) {}

  async execute(
    input: UpdatePropertyInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const propertyId = PropertyId.safeParse(input.propertyId);

    if (!propertyId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const adminUserId = UserId.safeParse(input.adminUserId);

    if (!adminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const found = await this.deps.propertyRepository.findById(propertyId.data);

    if (!found.success) {
      return failure(found.error);
    }

    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = found.value;

    if (!(await this.authorize(adminUserId.data, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    if (input.name !== undefined) {
      const name = PropertyName.safeParse(input.name);

      if (!name.success) {
        return failure(OrganizationDomainCodes.PROPERTY_NAME_EMPTY);
      }

      const r = property.rename(name.data, this.deps.profanityChecker);

      if (!r.success) {
        return failure(r.error);
      }
    }

    if (input.address !== undefined) {
      if (input.address !== null && typeof input.address !== 'string') {
        return failure('common.errors.unexpected');
      }

      const r = property.updateAddress(
        input.address?.trim() ? PropertyAddress.parse(input.address) : null,
        this.deps.profanityChecker
      );

      if (!r.success) {
        return failure(r.error);
      }
    }

    if (input.sizeUnit !== undefined) {
      const unit = SizeUnit.parse(input.sizeUnit);

      if (!unit.success) {
        return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
      }

      const r = property.updateSizeUnit(unit.value);

      if (!r.success) {
        return failure(r.error);
      }
    }

    return this.deps.propertyRepository.update(property);
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
