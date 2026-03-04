import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface UpdateOrganizationInput {
  organizationId: string;
  userId: string;
  name: string;
  description: string;
}

export interface UpdateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UpdateOrganizationUseCase {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: UpdateOrganizationDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(input: UpdateOrganizationInput): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check authorization: org admin or superadmin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(input.userId);
    const isOrgAdmin = await this.organizationRepository.isUserAdmin(
      input.userId,
      input.organizationId
    );

    if (!isOrgAdmin && !isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Check name uniqueness only if name changed
    if (input.name.trim() !== organization.name) {
      const existingOrg = await this.organizationRepository.findByName(
        input.name.trim()
      );

      if (existingOrg && existingOrg.id !== organization.id) {
        return failure(OrganizationErrors.NAME_EXISTS);
      }
    }

    const nameResult = organization.updateName(input.name);

    if (!nameResult.success) {
      return failure(nameResult.error);
    }

    const descResult = organization.updateDescription(input.description);

    if (!descResult.success) {
      return failure(descResult.error);
    }

    await this.organizationRepository.update(organization);

    return success(undefined);
  }
}
