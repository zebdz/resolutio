/** Authorizes a tree-wide member search and resolves the permitted organization IDs.
 * A typed directory port owns the storage query and public profile projection. */
import {
  DirectoryTreeMember,
  OrganizationDirectory,
} from './OrganizationDirectory';

import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { ResultLimit } from '../../domain/shared/Pagination';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export type OrgTreeMember = DirectoryTreeMember;

export interface SearchOrgTreeMembersInput {
  rootOrganizationId: string;
  actorUserId: string;
  query: string;
  // Hard ceiling on returned matches; UI typically wants ~20.
  limit: number;
}

export interface SearchOrgTreeMembersDependencies {
  directory: Pick<OrganizationDirectory, 'treeMembers'>;
  organizationRepository: Pick<
    OrganizationRepository,
    'findById' | 'isUserAdmin' | 'getDescendantIds'
  >;
  userRepository: Pick<UserRepository, 'isSuperAdmin'>;
}

// Tree-aware member search for picker UIs (EditOwnersModal, etc.). Authorized
// for admins of the root org and superadmins only — same gate as the rest of
// the cross-tree poll-creation flow. Search matches first/last/middle/nickname
// (substring, case-insensitive). Empty query returns the most recent N members
// across the tree so the dropdown isn't empty on first open.
export class SearchOrgTreeMembersUseCase {
  constructor(private deps: SearchOrgTreeMembersDependencies) {}

  async execute(
    input: SearchOrgTreeMembersInput
  ): Promise<Result<OrgTreeMember[], OrganizationUseCaseFailure>> {
    const parsedRootOrganizationId = OrganizationId.safeParse(
      input.rootOrganizationId
    );

    if (!parsedRootOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedActorUserId = UserId.safeParse(input.actorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const parsedLimit = ResultLimit.safeParse(input.limit);

    if (!parsedLimit.success) {
      return failure('common.errors.unexpected');
    }

    const command = {
      ...input,
      rootOrganizationId: parsedRootOrganizationId.data,
      actorUserId: parsedActorUserId.data,
      limit: parsedLimit.data,
    };

    const root = await this.deps.organizationRepository.findById(
      command.rootOrganizationId
    );

    if (!root) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(
      command.actorUserId
    );

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        command.actorUserId,
        command.rootOrganizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    const descendantIds =
      await this.deps.organizationRepository.getDescendantIds(
        command.rootOrganizationId
      );
    const treeOrgIds = [command.rootOrganizationId, ...descendantIds];

    return this.deps.directory.treeMembers({
      organizationIds: treeOrgIds,
      query: command.query,
      limit: command.limit,
    });
  }
}
