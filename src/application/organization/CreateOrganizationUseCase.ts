import { Organization } from '../../domain/organization/Organization';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateOrganizationInput } from './CreateOrganizationSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class CreateOrganizationUseCase {
  constructor(private deps: CreateOrganizationDependencies) {}

  async execute(
    input: CreateOrganizationInput,
    userId: string
  ): Promise<Result<{ organization: Organization }, string>> {
    const { name, description, parentId } = input;

    // Check if organization with this name already exists
    const existingOrg = await this.deps.organizationRepository.findByName(name);

    if (existingOrg) {
      return failure(OrganizationErrors.NAME_EXISTS);
    }

    // Validate that parent organization exists if parentId is provided
    if (parentId) {
      const parentOrg =
        await this.deps.organizationRepository.findById(parentId);

      if (!parentOrg) {
        return failure(OrganizationErrors.PARENT_NOT_FOUND);
      }

      if (parentOrg.isArchived()) {
        return failure(OrganizationErrors.PARENT_ARCHIVED);
      }

      // Check authorization: superadmin or parent org admin
      const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(userId);

      if (!isSuperAdmin) {
        const isAdmin = await this.deps.organizationRepository.isUserAdmin(
          userId,
          parentId
        );

        if (!isAdmin) {
          return failure(OrganizationErrors.NOT_ADMIN);
        }
      }
    }

    // Create the organization entity
    const organizationResult = Organization.create(
      name,
      description,
      userId,
      parentId
    );

    if (!organizationResult.success) {
      return failure(organizationResult.error);
    }

    const organization = organizationResult.value;

    // Save the organization
    const savedOrg = await this.deps.organizationRepository.save(organization);

    return success({
      organization: savedOrg,
    });
  }
}
