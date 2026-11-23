/** Authorizes organization directory access after validating external query values.
 * The typed read port isolates storage projections and query implementation. */
import { ResultCount } from '../../domain/shared/Pagination';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { PageNumber, PageSize } from '../../domain/shared/Pagination';
import { OrganizationDirectory, DirectoryAdmin } from './OrganizationDirectory';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export type OrgAdmin = DirectoryAdmin;

export interface GetOrgAdminsPaginatedInput {
  organizationId: string;
  actorUserId: string;
  page: number;
  pageSize: number;
  query?: string;
}

export interface GetOrgAdminsPaginatedDependencies {
  directory: Pick<OrganizationDirectory, 'admins'>;
  organizationRepository: Pick<
    OrganizationRepository,
    'findById' | 'isUserMember' | 'isUserAdmin'
  >;
  userRepository: Pick<UserRepository, 'isSuperAdmin'>;
}

export class GetOrgAdminsPaginatedUseCase {
  constructor(private deps: GetOrgAdminsPaginatedDependencies) {}

  async execute(
    input: GetOrgAdminsPaginatedInput
  ): Promise<
    Result<
      { admins: OrgAdmin[]; totalCount: ResultCount },
      OrganizationUseCaseFailure
    >
  > {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedActorUserId = UserId.safeParse(input.actorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const parsedPage = PageNumber.safeParse(input.page);

    if (!parsedPage.success) {
      return failure('common.errors.unexpected');
    }

    const parsedPageSize = PageSize.safeParse(input.pageSize);

    if (!parsedPageSize.success) {
      return failure('common.errors.unexpected');
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      actorUserId: parsedActorUserId.data,
      page: parsedPage.data,
      pageSize: parsedPageSize.data,
    };

    const { organizationId, actorUserId, page, pageSize, query } = command;

    // Check org exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check authorization: org member, admin, or superadmin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isMember = await this.deps.organizationRepository.isUserMember(
        actorUserId,
        organizationId
      );
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        organizationId
      );

      if (!isMember && !isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    return this.deps.directory.admins({
      organizationId,
      page,
      pageSize,
      query,
    });
  }
}
