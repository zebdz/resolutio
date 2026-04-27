import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreatePropertyInput {
  organizationId: string;
  adminUserId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
}

export interface CreatePropertyDependencies {
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreatePropertyUseCase {
  constructor(private deps: CreatePropertyDependencies) {}

  async execute(
    input: CreatePropertyInput
  ): Promise<Result<{ property: OrganizationProperty }, string>> {
    const isAuthorized = await this.authorize(
      input.adminUserId,
      input.organizationId
    );

    if (!isAuthorized) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const created = OrganizationProperty.create(
      input.organizationId,
      input.name,
      input.address,
      input.sizeUnit,
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

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
