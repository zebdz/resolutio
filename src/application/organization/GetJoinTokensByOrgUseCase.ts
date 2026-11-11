/** Join-link application boundary validates external values before invoking
 * domain behavior and typed authorization/persistence ports. */
import { ResultCount } from '../../domain/shared/Pagination';
import { UserId } from '../../domain/shared/EntityIds';
import { OrganizationId } from '../../domain/shared/EntityIds';
import { PageNumber } from '../../domain/shared/Pagination';
import { PageSize } from '../../domain/shared/Pagination';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import {
  JoinTokenRepository,
  JoinTokenWithCreator,
} from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface GetJoinTokensByOrgDependencies {
  organizationRepository: OrganizationRepository;
  joinTokenRepository: JoinTokenRepository;
  userRepository: UserRepository;
}

export interface GetJoinTokensByOrgInput {
  organizationId: string;
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}

export class GetJoinTokensByOrgUseCase {
  constructor(private deps: GetJoinTokensByOrgDependencies) {}

  async execute(
    input: GetJoinTokensByOrgInput,
    rawActorUserId: string
  ): Promise<
    Result<
      { tokens: JoinTokenWithCreator[]; totalCount: ResultCount },
      OrganizationUseCaseFailure
    >
  > {
    const parsedActorUserId = UserId.safeParse(rawActorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const actorUserId = parsedActorUserId.data;
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
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
      page: parsedPage.data,
      pageSize: parsedPageSize.data,
    };

    // 1. Find org
    const org = await this.deps.organizationRepository.findById(
      command.organizationId
    );

    if (!org) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // 2. Check actor is admin/superadmin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        command.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 3. Fetch tokens
    const result = await this.deps.joinTokenRepository.findByOrganizationId(
      command.organizationId,
      {
        search: command.search,
        page: command.page,
        pageSize: command.pageSize,
        activeOnly: command.activeOnly,
      }
    );

    return success(result);
  }
}
