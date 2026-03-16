import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import {
  JoinTokenRepository,
  JoinTokenWithCreator,
} from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

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
    actorUserId: string
  ): Promise<
    Result<{ tokens: JoinTokenWithCreator[]; totalCount: number }, string>
  > {
    // 1. Find org
    const org = await this.deps.organizationRepository.findById(
      input.organizationId
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
        input.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 3. Fetch tokens
    const result = await this.deps.joinTokenRepository.findByOrganizationId(
      input.organizationId,
      {
        search: input.search,
        page: input.page,
        pageSize: input.pageSize,
        activeOnly: input.activeOnly,
      }
    );

    return success(result);
  }
}
