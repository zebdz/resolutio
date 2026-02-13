import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { CancelJoinParentRequestInput } from './CancelJoinParentRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface CancelJoinParentRequestDependencies {
  joinParentRequestRepository: JoinParentRequestRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class CancelJoinParentRequestUseCase {
  constructor(private deps: CancelJoinParentRequestDependencies) {}

  async execute(
    input: CancelJoinParentRequestInput
  ): Promise<Result<void, string>> {
    const { requestId, adminUserId } = input;

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

    // 3. Check admin permissions: superadmin or admin of child org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        adminUserId,
        request.childOrgId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 4. Delete the request (link row, OK to delete per project rules)
    await this.deps.joinParentRequestRepository.delete(requestId);

    return success(undefined);
  }
}
