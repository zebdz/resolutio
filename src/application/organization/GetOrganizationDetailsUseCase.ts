import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';
import { Board } from '../../domain/board/Board';
import { OrganizationErrors } from './OrganizationErrors';

export interface GetOrganizationDetailsInput {
  organizationId: string;
  userId?: string; // Optional - for checking membership status
}

export interface BoardWithMemberCount {
  board: Board;
  memberCount: number;
  isUserMember: boolean;
}

export interface OrganizationDetailsResult {
  organization: Organization;
  boards: BoardWithMemberCount[];
  isUserMember: boolean;
  isUserAdmin: boolean;
  firstAdmin: { id: string; firstName: string; lastName: string } | null;
}

export interface GetOrganizationDetailsDependencies {
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  prisma: any; // For custom queries
}

export class GetOrganizationDetailsUseCase {
  constructor(private deps: GetOrganizationDetailsDependencies) {}

  async execute(
    input: GetOrganizationDetailsInput
  ): Promise<Result<OrganizationDetailsResult, string>> {
    const { organizationId, userId } = input;

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
    const boardsWithDetails = await Promise.all(
      boards
        .filter((board) => !board.isArchived())
        .map(async (board) => {
          const memberCount = await this.deps.prisma.boardUser.count({
            where: {
              boardId: board.id,
              removedAt: null, // Only count active members
            },
          });

          const isUserMember = userId
            ? await this.deps.boardRepository.isUserMember(userId, board.id)
            : false;

          return {
            board,
            memberCount,
            isUserMember,
          };
        })
    );

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

    // Get first admin
    const firstAdmin = await this.deps.prisma.organizationAdminUser.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return success({
      organization,
      boards: boardsWithDetails,
      isUserMember,
      isUserAdmin,
      firstAdmin: firstAdmin
        ? {
            id: firstAdmin.user.id,
            firstName: firstAdmin.user.firstName,
            lastName: firstAdmin.user.lastName,
          }
        : null,
    });
  }
}
