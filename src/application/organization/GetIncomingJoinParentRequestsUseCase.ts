import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { JoinParentRequest } from '../../domain/organization/JoinParentRequest';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetIncomingJoinParentRequestsDependencies {
  joinParentRequestRepository: JoinParentRequestRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export interface GetIncomingJoinParentRequestsInput {
  parentOrgId: string;
  adminUserId: string;
}

export class GetIncomingJoinParentRequestsUseCase {
  constructor(private deps: GetIncomingJoinParentRequestsDependencies) {}

  async execute(
    input: GetIncomingJoinParentRequestsInput
  ): Promise<Result<JoinParentRequest[], string>> {
    const { parentOrgId, adminUserId } = input;

    // Check admin permissions: superadmin or admin of parent org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        adminUserId,
        parentOrgId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    const requests =
      await this.deps.joinParentRequestRepository.findPendingByParentOrgId(
        parentOrgId
      );

    return success(requests);
  }
}
