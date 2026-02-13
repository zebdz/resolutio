import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { JoinParentRequest } from '../../domain/organization/JoinParentRequest';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { RequestJoinParentInput } from './RequestJoinParentSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyJoinParentRequestReceivedUseCase } from '../notification/NotifyJoinParentRequestReceivedUseCase';

export interface RequestJoinParentDependencies {
  organizationRepository: OrganizationRepository;
  joinParentRequestRepository: JoinParentRequestRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RequestJoinParentUseCase {
  constructor(private deps: RequestJoinParentDependencies) {}

  async execute(input: RequestJoinParentInput): Promise<Result<void, string>> {
    const { childOrgId, parentOrgId, adminUserId, message } = input;

    // 1. Check admin permissions: superadmin or admin of child org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        adminUserId,
        childOrgId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 2. Check child org exists and not archived
    const childOrg =
      await this.deps.organizationRepository.findById(childOrgId);

    if (!childOrg) {
      return failure(OrganizationErrors.CHILD_ORG_NOT_FOUND);
    }

    if (childOrg.isArchived()) {
      return failure(OrganizationErrors.CHILD_ORG_ARCHIVED);
    }

    // 3. Check not same org
    if (childOrgId === parentOrgId) {
      return failure(OrganizationErrors.SAME_ORGANIZATION);
    }

    // 4. Check parent org exists and not archived
    const parentOrg =
      await this.deps.organizationRepository.findById(parentOrgId);

    if (!parentOrg) {
      return failure(OrganizationErrors.PARENT_NOT_FOUND);
    }

    if (parentOrg.isArchived()) {
      return failure(OrganizationErrors.PARENT_ARCHIVED);
    }

    // 5. Check no pending request for this child org
    const pendingRequest =
      await this.deps.joinParentRequestRepository.findPendingByChildOrgId(
        childOrgId
      );

    if (pendingRequest) {
      return failure(OrganizationErrors.PENDING_PARENT_REQUEST);
    }

    // 6. Check parent is not a descendant of child (cycle prevention)
    const descendantIds =
      await this.deps.organizationRepository.getDescendantIds(childOrgId);

    if (descendantIds.includes(parentOrgId)) {
      return failure(OrganizationErrors.CANNOT_JOIN_OWN_DESCENDANT);
    }

    // 7. Create the request
    const requestResult = JoinParentRequest.create(
      childOrgId,
      parentOrgId,
      adminUserId,
      message
    );

    if (!requestResult.success) {
      return failure(requestResult.error);
    }

    await this.deps.joinParentRequestRepository.save(requestResult.value);

    // Notify admins of parent org
    const notifyUseCase = new NotifyJoinParentRequestReceivedUseCase({
      organizationRepository: this.deps.organizationRepository,
      notificationRepository: this.deps.notificationRepository,
    });
    await notifyUseCase.execute({ childOrgId, parentOrgId });

    return success(undefined);
  }
}
