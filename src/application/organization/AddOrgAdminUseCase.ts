import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface AddOrgAdminInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}

export interface AddOrgAdminDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class AddOrgAdminUseCase {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: AddOrgAdminDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(input: AddOrgAdminInput): Promise<Result<void, string>> {
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check authorization
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.actorUserId
    );
    const isOrgAdmin = await this.organizationRepository.isUserAdmin(
      input.actorUserId,
      input.organizationId
    );

    if (!isOrgAdmin && !isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Check target user exists
    const targetUser = await this.userRepository.findById(input.targetUserId);

    if (!targetUser) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    // Check target is not already admin
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      input.targetUserId,
      input.organizationId
    );

    if (isTargetAdmin) {
      return failure(OrganizationErrors.ALREADY_ADMIN);
    }

    await this.organizationRepository.addAdmin(
      input.organizationId,
      input.targetUserId
    );

    return success(undefined);
  }
}
