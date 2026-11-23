/** Authorizes an organization's pending-request read and returns typed requester data.
 * The directory adapter owns storage queries and decodes request timestamps. */
import {
  OrganizationDirectory,
  DirectoryPerson,
} from './OrganizationDirectory';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Instant } from '../../domain/shared/Instant';
import { ResultCount } from '../../domain/shared/Pagination';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { PageNumber, PageSize } from '../../domain/shared/Pagination';
import { Result, success, failure } from '../../domain/shared/Result';
import { UserRepository } from '../../domain/user/UserRepository';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface GetOrganizationPendingRequestsInput {
  organizationId: string;
  adminUserId: string;
  page?: number;
  pageSize?: number;
}

export interface PendingRequest {
  userId: UserId;
  firstName: DirectoryPerson['firstName'];
  lastName: DirectoryPerson['lastName'];
  middleName: DirectoryPerson['middleName'];
  requestedAt: Instant;
}

export interface GetOrganizationPendingRequestsResult {
  requests: PendingRequest[];
  totalCount: ResultCount;
}

export interface GetOrganizationPendingRequestsDependencies {
  directory: Pick<OrganizationDirectory, 'pendingForOrganization'>;
  organizationRepository: Pick<
    OrganizationRepository,
    'findById' | 'isUserAdmin'
  >;
  userRepository: Pick<UserRepository, 'isSuperAdmin'>;
}

export class GetOrganizationPendingRequestsUseCase {
  constructor(private deps: GetOrganizationPendingRequestsDependencies) {}

  async execute(
    input: GetOrganizationPendingRequestsInput
  ): Promise<
    Result<GetOrganizationPendingRequestsResult, OrganizationUseCaseFailure>
  > {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedAdminUserId = UserId.safeParse(input.adminUserId);

    if (!parsedAdminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const parsedPage = PageNumber.optional().safeParse(input.page);

    if (!parsedPage.success) {
      return failure('common.errors.unexpected');
    }

    const parsedPageSize = PageSize.optional().safeParse(input.pageSize);

    if (!parsedPageSize.success) {
      return failure('common.errors.unexpected');
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      adminUserId: parsedAdminUserId.data,
      page: parsedPage.data,
      pageSize: parsedPageSize.data,
    };

    const { organizationId, adminUserId, page, pageSize } = command;

    // Check if organization exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check admin permissions: superadmin or org admin
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

    const result = await this.deps.directory.pendingForOrganization({
      organizationId,
      pagination:
        page !== undefined && pageSize !== undefined
          ? { page, pageSize }
          : undefined,
    });

    if (!result.success) {
      return result;
    }

    return success({
      requests: result.value.requests.map(({ requester, requestedAt }) => ({
        userId: requester.id,
        firstName: requester.firstName,
        lastName: requester.lastName,
        middleName: requester.middleName,
        requestedAt,
      })),
      totalCount: result.value.totalCount,
    });
  }
}
