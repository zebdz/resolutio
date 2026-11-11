/** Parent-link request application boundary validates external identities before
 * invoking domain decisions and typed authorization/persistence ports. */
import { JoinParentRequestDomainCode } from '../../domain/organization/JoinParentRequestDomainCodes';
import { Clock, IdGenerator } from '../shared/EntityCreation';
import { parseJoinParentRejectionReason } from '../../domain/organization/JoinParentRequestValues';

import { JoinParentRequestId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinParentRequestInput } from './HandleJoinParentRequestSchema';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyOrgJoinedParentUseCase } from '../notification/NotifyOrgJoinedParentUseCase';
import { NotifyJoinParentRequestRejectedUseCase } from '../notification/NotifyJoinParentRequestRejectedUseCase';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export interface HandleJoinParentRequestDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  joinParentRequestRepository: JoinParentRequestRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
  profanityChecker?: ProfanityChecker;
}

export class HandleJoinParentRequestUseCase {
  constructor(private deps: HandleJoinParentRequestDependencies) {}

  async execute(
    input: HandleJoinParentRequestInput
  ): Promise<
    Result<void, OrganizationUseCaseFailure | JoinParentRequestDomainCode>
  > {
    const parsedRequestId = JoinParentRequestId.safeParse(input.requestId);

    if (!parsedRequestId.success) {
      return failure(OrganizationErrors.PARENT_REQUEST_NOT_FOUND);
    }

    const parsedAdminUserId = UserId.safeParse(input.adminUserId);

    if (!parsedAdminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      requestId: parsedRequestId.data,
      adminUserId: parsedAdminUserId.data,
    };

    const { requestId, adminUserId, action, rejectionReason } = command;

    if (action !== 'accept' && action !== 'reject') {
      return failure(OrganizationErrors.INVALID_STATUS);
    }

    // 1. Find the request
    const request =
      await this.deps.joinParentRequestRepository.findById(requestId);

    if (!request) {
      return failure(OrganizationErrors.PARENT_REQUEST_NOT_FOUND);
    }

    // 2. Check request is pending
    if (!request.isPending()) {
      return failure(OrganizationErrors.PARENT_REQUEST_NOT_PENDING);
    }

    // 3. Check admin permissions: superadmin or admin of parent org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        adminUserId,
        request.parentOrgId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    if (action === 'accept') {
      // 4a. Re-verify no cycle before accepting
      const descendantIds =
        await this.deps.organizationRepository.getDescendantIds(
          request.childOrgId
        );

      if (descendantIds.includes(request.parentOrgId)) {
        return failure(OrganizationErrors.CANNOT_JOIN_OWN_DESCENDANT);
      }

      // 4b. Check for overlapping members between the two trees
      // Skip if child is already in the parent's tree (reparenting within same tree)
      const parentAncestorIds =
        await this.deps.organizationRepository.getAncestorIds(
          request.childOrgId
        );
      const isAlreadyInSameTree =
        parentAncestorIds.includes(request.parentOrgId) ||
        descendantIds.includes(request.parentOrgId);

      if (!isAlreadyInSameTree) {
        const [childTreeMembers, parentTreeMembers] = await Promise.all([
          this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
            request.childOrgId
          ),
          this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
            request.parentOrgId
          ),
        ]);

        const parentMemberSet = new Set(parentTreeMembers);
        const overlappingUserIds = childTreeMembers.filter((id) =>
          parentMemberSet.has(id)
        );

        if (overlappingUserIds.length > 0) {
          const [childTreeAllows, parentTreeAllows] = await Promise.all([
            this.deps.organizationRepository.getRootAllowMultiTreeMembership(
              request.childOrgId
            ),
            this.deps.organizationRepository.getRootAllowMultiTreeMembership(
              request.parentOrgId
            ),
          ]);

          if (!childTreeAllows || !parentTreeAllows) {
            return failure(OrganizationErrors.MULTI_MEMBERSHIP_CONFLICT);
          }
        }
      }

      // 5a. Accept the request
      const accepted = request.accept(adminUserId, this.deps.clock.now());

      if (!accepted.success) {
        return accepted;
      }

      await this.deps.joinParentRequestRepository.update(request);

      // 6a. Set parentId on child org
      await this.deps.organizationRepository.setParentId(
        request.childOrgId,
        request.parentOrgId
      );

      // 7a. Notify members of child org
      const notifyUseCase = new NotifyOrgJoinedParentUseCase({
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      });
      const delivery = await notifyUseCase.execute({
        childOrgId: request.childOrgId,
        parentOrgId: request.parentOrgId,
      });

      if (!delivery.success) {
        return failure('common.errors.unexpected');
      }
    } else {
      // 4b. Reject requires reason
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        return failure(OrganizationErrors.REJECTION_REASON_REQUIRED);
      }

      // 5b. Reject the request
      const reason = parseJoinParentRejectionReason(rejectionReason);

      if (!reason.success) {
        return reason;
      }

      const rejected = request.reject(
        adminUserId,
        reason.value,
        this.deps.clock.now(),
        this.deps.profanityChecker
      );

      if (!rejected.success) {
        return rejected;
      }

      await this.deps.joinParentRequestRepository.update(request);

      // 6b. Notify child org admins + members
      const notifyRejectedUseCase = new NotifyJoinParentRequestRejectedUseCase({
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      });
      const delivery = await notifyRejectedUseCase.execute({
        childOrgId: request.childOrgId,
        parentOrgId: request.parentOrgId,
        rejectionReason: reason.value,
      });

      if (!delivery.success) {
        return failure('common.errors.unexpected');
      }
    }

    return success(undefined);
  }
}
