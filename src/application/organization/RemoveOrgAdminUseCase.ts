import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface RemoveOrgAdminInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}

export interface RemoveOrgAdminDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class RemoveOrgAdminUseCase {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: RemoveOrgAdminDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(input: RemoveOrgAdminInput): Promise<Result<void, string>> {
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

    // Cannot remove self
    if (input.actorUserId === input.targetUserId) {
      return failure(OrganizationErrors.CANNOT_REMOVE_SELF);
    }

    // Check target is an admin
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      input.targetUserId,
      input.organizationId
    );

    if (!isTargetAdmin) {
      return failure(OrganizationErrors.NOT_ORG_ADMIN);
    }

    // Remove admin — repo guarantees at least 1 admin remains via transaction
    try {
      await this.organizationRepository.removeAdmin(
        input.organizationId,
        input.targetUserId
      );
    } catch (error: any) {
      if (error.message === 'LAST_ADMIN') {
        return failure(OrganizationErrors.LAST_ADMIN);
      }

      throw error;
    }

    return success(undefined);
  }
}
