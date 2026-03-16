import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { JoinToken, JoinTokenProps } from '../../domain/organization/JoinToken';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateJoinTokenInput } from './CreateJoinTokenSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CreateJoinTokenDependencies {
  organizationRepository: OrganizationRepository;
  joinTokenRepository: JoinTokenRepository;
  userRepository: UserRepository;
}

export class CreateJoinTokenUseCase {
  constructor(private deps: CreateJoinTokenDependencies) {}

  async execute(
    input: CreateJoinTokenInput,
    actorUserId: string
  ): Promise<Result<JoinTokenProps, string>> {
    const { organizationId, description, maxUses } = input;

    // 1. Find org
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // 2. Check not archived
    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // 3. Check actor is admin or superadmin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 4. Create domain entity
    const createResult = JoinToken.create(
      organizationId,
      actorUserId,
      description,
      maxUses ?? null
    );

    if (!createResult.success) {
      return failure(createResult.error);
    }

    // 5. Save
    const saved = await this.deps.joinTokenRepository.save(createResult.value);

    return success(saved.toJSON());
  }
}
