import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
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

  async execute(input: UpdatePropertyInput): Promise<Result<void, string>> {
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

    if (input.name !== undefined) {
      const r = property.rename(input.name, this.deps.profanityChecker);

      if (!r.success) {
        return failure(r.error);
      }
    }

    if (input.address !== undefined) {
      const r = property.updateAddress(
        input.address,
        this.deps.profanityChecker
      );

      if (!r.success) {
        return failure(r.error);
      }
    }

    if (input.sizeUnit !== undefined) {
      const r = property.updateSizeUnit(input.sizeUnit);

      if (!r.success) {
        return failure(r.error);
      }
    }

    return this.deps.propertyRepository.update(property);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
