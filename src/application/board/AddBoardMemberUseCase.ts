/** AddBoardMember application flow decodes request identities before domain/repository use.
 * Authorization and persistence stay coordinated here; lifecycle decisions belong to Board. */
import { z } from 'zod';
import { BoardId, UserId } from '@/domain/shared/EntityIds';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors, BoardUseCaseError } from './BoardErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

/** Raw request values, decoded once at the application boundary. */
export interface AddBoardMemberInput {
  boardId: string;
  userId: string;
  adminUserId: string;
}

const request = z.object({
  boardId: BoardId,
  userId: UserId,
  adminUserId: UserId,
});

export interface AddBoardMemberDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class AddBoardMemberUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: AddBoardMemberDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(
    rawInput: AddBoardMemberInput
  ): Promise<Result<void, BoardUseCaseError>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = decoded.data;

    // Find the board
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    // Check if board is archived
    if (board.isArchived()) {
      return failure(BoardErrors.BOARD_ARCHIVED);
    }

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.adminUserId
    );

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.adminUserId,
        board.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
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
