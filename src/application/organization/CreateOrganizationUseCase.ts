/** Creation boundary validates request values and supplies explicit identity/time
 * before persisting the organization aggregate. Existing authorization rules remain here. */
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import {
  parseOrganizationName,
  parseOrganizationDescription,
} from '../../domain/organization/OrganizationValues';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { Organization } from '../../domain/organization/Organization';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateOrganizationInput } from './CreateOrganizationSchema';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface CreateOrganizationDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
}

export class CreateOrganizationUseCase {
  constructor(private deps: CreateOrganizationDependencies) {}

  async execute(
    input: CreateOrganizationInput,
    rawUserId: string
  ): Promise<
    Result<{ organization: Organization }, OrganizationUseCaseFailure>
  > {
    const actor = UserId.safeParse(rawUserId);

    if (!actor.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const userId = actor.data;
    const parsedName = parseOrganizationName(input.name);

    if (!parsedName.success) {
      return parsedName;
    }

    const parsedDescription = parseOrganizationDescription(input.description);

    if (!parsedDescription.success) {
      return parsedDescription;
    }

    const parent = OrganizationId.nullish().safeParse(input.parentId);

    if (!parent.success) {
      return failure(OrganizationErrors.PARENT_NOT_FOUND);
    }

    const name = parsedName.value;
    const description = parsedDescription.value;
    const parentId = parent.data ?? null;

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
      parentId === null
        ? {
            kind: 'root',
            allowMultiTreeMembership: input.allowMultiTreeMembership ?? false,
          }
        : { kind: 'child', parentId },
      entityCreation(OrganizationId, this.deps.ids, this.deps.clock),
      this.deps.profanityChecker
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
