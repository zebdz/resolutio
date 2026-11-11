/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

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

  async execute(
    input: AddOrgAdminInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedTargetUserId = UserId.safeParse(input.targetUserId);

    if (!parsedTargetUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const parsedActorUserId = UserId.safeParse(input.actorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      targetUserId: parsedTargetUserId.data,
      actorUserId: parsedActorUserId.data,
    };

    const organization = await this.organizationRepository.findById(
      command.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check authorization
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      command.actorUserId
    );
    const isOrgAdmin = await this.organizationRepository.isUserAdmin(
      command.actorUserId,
      command.organizationId
    );

    if (!isOrgAdmin && !isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Check target user exists
    const targetUser = await this.userRepository.findById(command.targetUserId);

    if (!targetUser) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    // Check target is not already admin
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      command.targetUserId,
      command.organizationId
    );

    if (isTargetAdmin) {
      return failure(OrganizationErrors.ALREADY_ADMIN);
    }

    await this.organizationRepository.addAdmin(
      command.organizationId,
      command.targetUserId
    );

    return success(undefined);
  }
}
