import { Organization } from '../../domain/organization/Organization';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateOrganizationInput } from './CreateOrganizationSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreateOrganizationDependencies {
  organizationRepository: OrganizationRepository;
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
