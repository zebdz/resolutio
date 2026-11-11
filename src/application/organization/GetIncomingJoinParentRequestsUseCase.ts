/** Parent-link request application boundary validates external identities before
 * invoking domain decisions and typed authorization/persistence ports. */
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinParentRequestRepository } from '../../domain/organization/JoinParentRequestRepository';
import { JoinParentRequest } from '../../domain/organization/JoinParentRequest';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

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
  ): Promise<Result<JoinParentRequest[], OrganizationUseCaseFailure>> {
    const parsedParentOrgId = OrganizationId.safeParse(input.parentOrgId);

    if (!parsedParentOrgId.success) {
      return failure(OrganizationErrors.PARENT_NOT_FOUND);
    }

    const parsedAdminUserId = UserId.safeParse(input.adminUserId);

    if (!parsedAdminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      parentOrgId: parsedParentOrgId.data,
      adminUserId: parsedAdminUserId.data,
    };

    const { parentOrgId, adminUserId } = command;

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
