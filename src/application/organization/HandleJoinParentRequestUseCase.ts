import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinParentRequestInput } from './HandleJoinParentRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyOrgJoinedParentUseCase } from '../notification/NotifyOrgJoinedParentUseCase';

export interface HandleJoinParentRequestDependencies {
  organizationRepository: OrganizationRepository;
  joinParentRequestRepository: JoinParentRequestRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class HandleJoinParentRequestUseCase {
  constructor(private deps: HandleJoinParentRequestDependencies) {}

  async execute(
    input: HandleJoinParentRequestInput
  ): Promise<Result<void, string>> {
    const { requestId, adminUserId, action, rejectionReason } = input;

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

      // 5a. Accept the request
      request.accept(adminUserId);
      await this.deps.joinParentRequestRepository.update(request);

      // 6a. Set parentId on child org
      await this.deps.organizationRepository.setParentId(
        request.childOrgId,
        request.parentOrgId
      );

      // 7a. Notify members of child org
      const notifyUseCase = new NotifyOrgJoinedParentUseCase({
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      });
      await notifyUseCase.execute({
        childOrgId: request.childOrgId,
        parentOrgId: request.parentOrgId,
      });
    } else {
      // 4b. Reject requires reason
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        return failure(OrganizationErrors.REJECTION_REASON_REQUIRED);
      }

      // 5b. Reject the request
      request.reject(adminUserId, rejectionReason);
      await this.deps.joinParentRequestRepository.update(request);
    }

    return success(undefined);
  }
}
