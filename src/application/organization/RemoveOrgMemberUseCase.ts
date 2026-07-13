import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
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
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveOrgMemberUseCase {
  private organizationRepository: OrganizationRepository;
  private boardRepository: BoardRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveOrgMemberDependencies) {
    this.organizationRepository = dependencies.organizationRepository;
    this.boardRepository = dependencies.boardRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: RemoveOrgMemberInput): Promise<Result<void, string>> {
    const reason = input.reason.trim();

    if (!reason) {
      return failure(OrganizationErrors.REASON_REQUIRED);
    }

    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Superadmin-only for now. To allow org admins later, also accept
    // organizationRepository.isUserAdmin(input.actorUserId, input.organizationId).
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.actorUserId
    );

    if (!isSuperAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    if (input.actorUserId === input.targetUserId) {
      return failure(OrganizationErrors.CANNOT_REMOVE_SELF);
    }

    // Exact-org check: we delete this org's membership row, so descendant
    // memberships (which isUserMember would also count) must not qualify.
    const isMember = await this.organizationRepository.isUserExactMember(
      input.targetUserId,
      input.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Drop org-admin role first; repo guarantees ≥1 admin remains
    const isTargetAdmin = await this.organizationRepository.isUserAdmin(
      input.targetUserId,
      input.organizationId
    );

    if (isTargetAdmin) {
      // Enforce the "≥1 admin must remain" invariant in the domain before mutating.
      const currentAdminIds =
        await this.organizationRepository.findAdminUserIds(
          input.organizationId
        );
      const canRemove = OrganizationAdminPolicy.ensureCanRemoveAdmin(
        currentAdminIds,
        input.targetUserId
      );

      if (!canRemove.success) {
        return failure(canRemove.error);
      }

      // The repository re-checks the invariant atomically as a concurrency net.
      try {
        await this.organizationRepository.removeAdmin(
          input.organizationId,
          input.targetUserId
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
      input.organizationId
    );

    for (const board of boards) {
      if (board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        input.targetUserId,
        board.id
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        input.targetUserId,
        board.id,
        input.actorUserId,
        'removed_from_organization'
      );
    }

    // Hard-delete membership + audit row (one transaction in the repo)
    await this.organizationRepository.removeMemberFromOrganization(
      input.organizationId,
      input.targetUserId,
      input.actorUserId,
      reason
    );

    // Fire-and-forget notification to the removed member
    new NotifyMemberRemovedFromOrganizationUseCase({
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: input.targetUserId,
        organizationId: input.organizationId,
        organizationName: organization.name,
      })
      .catch((err) =>
        console.error('Failed to notify member removed from organization:', err)
      );

    return success(undefined);
  }
}
