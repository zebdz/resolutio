/** Loads organization details and membership flags through typed core ports.
 * Public directory projections contain validated names and identities only. */
import {
  DirectoryPerson,
  OrganizationDirectory,
} from './OrganizationDirectory';
import { MemberCount } from '../../domain/organization/OrganizationValues';
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import {
  OrganizationRepository,
  OrganizationAncestor,
  OrganizationTreeNode,
} from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';
import { Board } from '../../domain/board/Board';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface GetOrganizationDetailsInput {
  organizationId: string;
  userId?: string; // Optional - for checking membership status
}

export type BoardMember = DirectoryPerson;

export interface BoardWithMemberCount {
  board: Board;
  memberCount: MemberCount;
  members: BoardMember[];
  isUserMember: boolean;
}

export interface OrganizationDetailsResult {
  organization: Organization;
  boards: BoardWithMemberCount[];
  isUserMember: boolean;
  isUserAdmin: boolean;
  firstAdmin: DirectoryPerson | null;
  ancestors: OrganizationAncestor[];
  hierarchyTree: OrganizationTreeNode;
}

export interface GetOrganizationDetailsDependencies {
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  directory: Pick<OrganizationDirectory, 'boardMembers' | 'firstAdmin'>;
}

export class GetOrganizationDetailsUseCase {
  constructor(private deps: GetOrganizationDetailsDependencies) {}

  async execute(
    input: GetOrganizationDetailsInput
  ): Promise<Result<OrganizationDetailsResult, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedUserId = UserId.optional().safeParse(input.userId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      userId: parsedUserId.data,
    };

    const { organizationId, userId } = command;

    // Fetch organization
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check if organization is archived
    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Get boards for organization
    const boards =
      await this.deps.boardRepository.findByOrganizationId(organizationId);

    // Get member counts and user membership for each board
    const boardResults = await Promise.all(
      boards
        .filter((board) => !board.isArchived())
        .map(async (board) => {
          const result = await this.deps.directory.boardMembers(board.id);

          if (!result.success) {
            return result;
          }

          const members = result.value;

          const isUserMember = userId
            ? await this.deps.boardRepository.isUserMember(userId, board.id)
            : false;

          return success({
            board,
            memberCount: MemberCount.parse(members.length),
            members,
            isUserMember,
          });
        })
    );

    const boardsWithDetails: BoardWithMemberCount[] = [];

    for (const result of boardResults) {
      if (!result.success) {
        return result;
      }

      boardsWithDetails.push(result.value);
    }

    // Check if user is member or admin of organization
    let isUserMember = false;
    let isUserAdmin = false;

    if (userId) {
      isUserMember = await this.deps.organizationRepository.isUserMember(
        userId,
        organizationId
      );

      const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(userId);
      isUserAdmin =
        isSuperAdmin ||
        (await this.deps.organizationRepository.isUserAdmin(
          userId,
          organizationId
        ));
    }

    // Get hierarchy tree
    const hierarchy =
      await this.deps.organizationRepository.getHierarchyTree(organizationId);

    // Get first admin
    const firstAdmin = await this.deps.directory.firstAdmin(organizationId);

    if (!firstAdmin.success) {
      return firstAdmin;
    }

    return success({
      organization,
      boards: boardsWithDetails,
      isUserMember,
      isUserAdmin,
      firstAdmin: firstAdmin.value,
      ancestors: hierarchy.ancestors,
      hierarchyTree: hierarchy.tree,
    });
  }
}
