/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { MemberRemovalReason } from '../../domain/organization/OrganizationValues';
import { BoardRepository } from '../../domain/board/BoardRepository';
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
import { NotifyMemberRemovedFromOrganizationUseCase } from '../notification/NotifyMemberRemovedFromOrganizationUseCase';

export interface RemoveOrgMemberInput {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
  reason: string;
}

export interface RemoveOrgMemberDependencies {
  clock: Clock;
  ids: IdGenerator;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveOrgMemberUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private organizationRepository: OrganizationRepository;
  private boardRepository: BoardRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveOrgMemberDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.organizationRepository = dependencies.organizationRepository;
    this.boardRepository = dependencies.boardRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(
    input: RemoveOrgMemberInput
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

    const parsedReason = MemberRemovalReason.safeParse(input.reason);

    if (!parsedReason.success) {
      return failure(OrganizationErrors.REASON_REQUIRED);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      targetUserId: parsedTargetUserId.data,
      actorUserId: parsedActorUserId.data,
      reason: parsedReason.data,
    };

    const reason = command.reason;

    if (!reason) {
      return failure(OrganizationErrors.REASON_REQUIRED);
    }

    const organization = await this.organizationRepository.findById(
      command.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Superadmin-only for now. To allow org admins later, also accept
    // organizationRepository.isUserAdmin(command.actorUserId, command.organizationId).
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      command.actorUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    if (command.actorUserId === command.targetUserId) {
      return failure(OrganizationErrors.CANNOT_REMOVE_SELF);
    }

    // Exact-org check: we delete this org's membership row, so descendant
    // memberships (which isUserMember would also count) must not qualify.
    const isMember = await this.organizationRepository.isUserExactMember(
      command.targetUserId,
      command.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Drop org-admin role first; repo guarantees ≥1 admin remains
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      command.targetUserId,
      command.organizationId
    );

    if (isTargetAdmin) {
      // Enforce the "≥1 admin must remain" invariant in the domain before mutating.
      const currentAdminIds =
        await this.organizationRepository.findAdminUserIds(
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
    }

    // Soft-remove from the org's boards (skip archived, mirrors leave-org)
    const boards = await this.boardRepository.findByOrganizationId(
      command.organizationId
    );

    for (const board of boards) {
      if (board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        command.targetUserId,
        board.id
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        command.targetUserId,
        board.id,
        command.actorUserId,
        'removed_from_organization'
      );
    }

    // Hard-delete membership + audit row (one transaction in the repo)
    await this.organizationRepository.removeMemberFromOrganization(
      command.organizationId,
      command.targetUserId,
      command.actorUserId,
      reason
    );

    // Fire-and-forget notification to the removed member
    new NotifyMemberRemovedFromOrganizationUseCase({
      ids: this.ids,
      clock: this.clock,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: command.targetUserId,
        organizationId: command.organizationId,
        organizationName: organization.name,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyMemberRemovedFromOrganizationUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) =>
        console.error('Failed to notify member removed from organization:', err)
      );

    return success(undefined);
  }
}
