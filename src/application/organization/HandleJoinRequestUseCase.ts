/** Authorizes membership decisions and supplies actor/time to the domain policy.
 * Persists the typed decision, then coordinates hierarchy changes and notifications. */
import { Clock, IdGenerator } from '../shared/EntityCreation';

import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { MembershipStore } from './MembershipStore';
import {
  MembershipReference,
  MembershipRejectionReason,
  MembershipAction,
  requirePendingMembership,
  decideMembershipRequest,
} from '../../domain/organization/MembershipPolicy';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { OrganizationMembershipService } from './OrganizationMembershipService';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinRequestInput } from './HandleJoinRequestSchema';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyJoinRequestAcceptedUseCase } from '../notification/NotifyJoinRequestAcceptedUseCase';
import { NotifyJoinRequestRejectedUseCase } from '../notification/NotifyJoinRequestRejectedUseCase';

export interface HandleJoinRequestDependencies {
  ids: IdGenerator;
  clock: Clock;
  memberships: Pick<MembershipStore, 'findStatus' | 'saveDecision'>;
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class HandleJoinRequestUseCase {
  constructor(private deps: HandleJoinRequestDependencies) {}

  async execute(
    input: HandleJoinRequestInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedRequesterId = UserId.safeParse(input.requesterId);

    if (!parsedRequesterId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const parsedAdminId = UserId.safeParse(input.adminId);

    if (!parsedAdminId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      requesterId: parsedRequesterId.data,
      adminId: parsedAdminId.data,
    };

    const {
      organizationId,
      requesterId,
      adminId,
      action,
      rejectionReason,
      silent,
    } = command;

    if (action !== 'accept' && action !== 'reject') {
      return failure(OrganizationErrors.INVALID_STATUS);
    }

    // 1. Check admin permissions: superadmin or org admin
    const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(adminId);

    if (!isSuperAdmin) {
      const adminRole = await this.deps.organizationRepository.isUserAdmin(
        adminId,
        organizationId
      );

      if (!adminRole) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 2. Load the request status and let the domain enforce pending-only decisions.
    const reference = MembershipReference.parse({
      organizationId,
      userId: requesterId,
    });
    const status = await this.deps.memberships.findStatus(reference);

    if (!status.success) {
      return status;
    }

    const pending = requirePendingMembership(status.value);

    if (!pending.success) {
      return pending;
    }

    const parsedReason = MembershipRejectionReason.nullable().safeParse(
      action === 'reject' ? rejectionReason || null : null
    );

    if (!parsedReason.success) {
      return failure('common.errors.validationFailed');
    }

    const decisionAction: MembershipAction =
      action === 'accept' ? { action } : { action, reason: parsedReason.data };
    const decision = decideMembershipRequest(
      status.value,
      decisionAction,
      adminId,
      this.deps.clock.now()
    );

    if (!decision.success) {
      return decision;
    }

    // 3. Persist the validated decision, then coordinate hierarchy membership.
    const saved = await this.deps.memberships.saveDecision(
      reference,
      decision.value
    );

    if (!saved.success) {
      return saved;
    }

    if (action === 'accept') {
      // Remove user from existing memberships in hierarchy orgs
      // (unless tree allows multi-membership)
      const allowsMulti =
        await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
          organizationId
        );

      if (!allowsMulti) {
        await OrganizationMembershipService.removeUserFromHierarchyOrgs(
          requesterId,
          organizationId,
          this.deps.organizationRepository
        );
      }
    }

    // 4. Notify requester (fire-and-forget, skip for autoJoin)
    if (!silent) {
      const notifyDeps = {
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      };

      if (action === 'accept') {
        new NotifyJoinRequestAcceptedUseCase(notifyDeps)
          .execute({ organizationId, requesterUserId: requesterId })
          .then((outcome) => {
            if (!outcome.success) {
              console.error(
                'Notification delivery failed (NotifyJoinRequestAcceptedUseCase):',
                outcome.error
              );
            }
          })
          .catch((err) =>
            console.error('Failed to notify join request accepted:', err)
          );
      } else {
        new NotifyJoinRequestRejectedUseCase(notifyDeps)
          .execute({
            organizationId,
            requesterUserId: requesterId,
            rejectionReason: rejectionReason || '',
          })
          .then((outcome) => {
            if (!outcome.success) {
              console.error(
                'Notification delivery failed (NotifyJoinRequestRejectedUseCase):',
                outcome.error
              );
            }
          })
          .catch((err) =>
            console.error('Failed to notify join request rejected:', err)
          );
      }
    }

    return success(undefined);
  }
}
