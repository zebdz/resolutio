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

export interface GetAllJoinParentRequestsDependencies {
  joinParentRequestRepository: JoinParentRequestRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export interface GetAllJoinParentRequestsResult {
  incoming: JoinParentRequest[];
  outgoing: JoinParentRequest[];
}

export class GetAllJoinParentRequestsUseCase {
  constructor(private deps: GetAllJoinParentRequestsDependencies) {}

  async execute(input: {
    organizationId: string;
    adminUserId: string;
  }): Promise<
    Result<GetAllJoinParentRequestsResult, OrganizationUseCaseFailure>
  > {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedAdminUserId = UserId.safeParse(input.adminUserId);

    if (!parsedAdminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      adminUserId: parsedAdminUserId.data,
    };

    const { organizationId, adminUserId } = command;

    // Check admin permissions: superadmin or admin of org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        adminUserId,
        organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    const [incoming, outgoing] = await Promise.all([
      this.deps.joinParentRequestRepository.findAllByParentOrgId(
        organizationId
      ),
      this.deps.joinParentRequestRepository.findAllByChildOrgId(organizationId),
    ]);

    return success({ incoming, outgoing });
  }
}
