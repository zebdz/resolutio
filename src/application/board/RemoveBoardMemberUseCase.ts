import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface RemoveBoardMemberInput {
  boardId: string;
  userId: string;
  adminUserId: string;
  reason?: string;
}

export interface RemoveBoardMemberDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
}

export class RemoveBoardMemberUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;

  constructor(dependencies: RemoveBoardMemberDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
  }

  async execute(input: RemoveBoardMemberInput): Promise<Result<void, string>> {
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
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Check if user is a member of the board
    const isBoardMember = await this.boardRepository.isUserMember(
      input.userId,
      input.boardId
    );

    if (!isBoardMember) {
      return failure(BoardErrors.NOT_MEMBER);
    }

    // Remove user from board
    await this.boardRepository.removeUserFromBoard(
      input.userId,
      input.boardId,
      input.adminUserId,
      input.reason
    );

    return success(undefined);
  }
}
