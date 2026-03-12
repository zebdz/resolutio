import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { User } from '../../domain/user/User';
import { NotifyAdminRemovedUseCase } from '../notification/NotifyAdminRemovedUseCase';

export interface RemoveOrgAdminInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}

export interface RemoveOrgAdminDependencies {
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveOrgAdminUseCase {
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveOrgAdminDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
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

    // Notify removed admin (fire-and-forget)
    const actor = await this.userRepository.findById(input.actorUserId);
    const actorName = actor
      ? User.formatFullName(actor.firstName, actor.lastName, actor.middleName)
      : '';

    new NotifyAdminRemovedUseCase({
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: input.targetUserId,
        organizationId: input.organizationId,
        organizationName: organization.name,
        actorName,
      })
      .catch((err) => console.error('Failed to notify admin removed:', err));

    return success(undefined);
  }
}
