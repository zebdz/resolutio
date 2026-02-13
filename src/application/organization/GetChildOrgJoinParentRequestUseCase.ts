import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { JoinParentRequest } from '../../domain/organization/JoinParentRequest';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetChildOrgJoinParentRequestDependencies {
  joinParentRequestRepository: JoinParentRequestRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export interface GetChildOrgJoinParentRequestInput {
  childOrgId: string;
  adminUserId: string;
}

export class GetChildOrgJoinParentRequestUseCase {
  constructor(private deps: GetChildOrgJoinParentRequestDependencies) {}

  async execute(
    input: GetChildOrgJoinParentRequestInput
  ): Promise<Result<JoinParentRequest | null, string>> {
    const { childOrgId, adminUserId } = input;

    // Check admin permissions: superadmin or admin of child org
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

    const request =
      await this.deps.joinParentRequestRepository.findPendingByChildOrgId(
        childOrgId
      );

    return success(request);
  }
}
