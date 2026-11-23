/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { OrganizationAdminPolicy } from '../../domain/organization/OrganizationAdminPolicy';
import { LastAdminError } from '../../domain/organization/LastAdminError';
import { User } from '../../domain/user/User';
import { NotifyAdminRemovedUseCase } from '../notification/NotifyAdminRemovedUseCase';

export interface RemoveOrgAdminInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}

export interface RemoveOrgAdminDependencies {
  clock: Clock;
  ids: IdGenerator;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveOrgAdminUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveOrgAdminDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(
    input: RemoveOrgAdminInput
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

    // Cannot remove self
    if (command.actorUserId === command.targetUserId) {
      return failure(OrganizationErrors.CANNOT_REMOVE_SELF);
    }

    // Check target is an admin
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      command.targetUserId,
      command.organizationId
    );

    if (!isTargetAdmin) {
      return failure(OrganizationErrors.NOT_ORG_ADMIN);
    }

    // Enforce the "≥1 admin must remain" invariant in the domain before mutating.
    const currentAdminIds = await this.organizationRepository.findAdminUserIds(
      command.organizationId
    );
    const canRemove = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      currentAdminIds,
      command.targetUserId
    );

    if (!canRemove.success) {
      return failure(canRemove.error);
    }

    // The repository re-checks the invariant atomically as a concurrency net.
    try {
      await this.organizationRepository.removeAdmin(
        command.organizationId,
        command.targetUserId
      );
    } catch (error) {
      if (error instanceof LastAdminError) {
        return failure(OrganizationDomainCodes.LAST_ADMIN);
      }

      throw error;
    }

    // Notify removed admin (fire-and-forget)
    const actor = await this.userRepository.findById(command.actorUserId);
    const actorName = actor
      ? User.formatFullName(actor.firstName, actor.lastName, actor.middleName)
      : '';

    new NotifyAdminRemovedUseCase({
      ids: this.ids,
      clock: this.clock,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: command.targetUserId,
        organizationId: command.organizationId,
        organizationName: organization.name,
        actorName,
      })
      .then((result) => {
        if (!result.success) {
          console.error('Failed to notify admin removed:', result.error);
        }
      })
      .catch((err) => console.error('Failed to notify admin removed:', err));

    return success(undefined);
  }
}
