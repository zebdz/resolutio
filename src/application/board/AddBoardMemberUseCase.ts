import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';

export interface AddBoardMemberInput {
  boardId: string;
  userId: string;
  adminUserId: string;
}

export interface AddBoardMemberDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
}

export class AddBoardMemberUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;

  constructor(dependencies: AddBoardMemberDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
  }

  async execute(input: AddBoardMemberInput): Promise<Result<void, string>> {
    // Find the board
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    // Check if board is archived
    if (board.isArchived()) {
      return failure(BoardErrors.BOARD_ARCHIVED);
    }

    // Check if admin user is an admin of the organization
    const isAdmin = await this.organizationRepository.isUserAdmin(
      input.adminUserId,
      board.organizationId
    );

    if (!isAdmin) {
      return failure('organization.errors.notAdmin');
    }

    // Check if the user being added is a member of the organization
    const isOrgMember = await this.organizationRepository.isUserMember(
      input.userId,
      board.organizationId
    );

    // If the board is general, only organization members can be added
    if (board.isGeneral && !isOrgMember) {
      return failure(BoardErrors.USER_NOT_ORG_MEMBER);
    }

    // Check if user is already a member of the board
    const isBoardMember = await this.boardRepository.isUserMember(
      input.userId,
      input.boardId
    );

    if (isBoardMember) {
      return failure(BoardErrors.ALREADY_MEMBER);
    }

    // Add user to board
    await this.boardRepository.addUserToBoard(
      input.userId,
      input.boardId,
      input.adminUserId
    );

    return success(undefined);
  }
}
