import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';
import { User } from '../../domain/user/User';
import { NotifyBoardMemberRemovedUseCase } from '../notification/NotifyBoardMemberRemovedUseCase';

export interface RemoveBoardMemberInput {
  boardId: string;
  userId: string;
  adminUserId: string;
  reason?: string;
}

export interface RemoveBoardMemberDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RemoveBoardMemberUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: RemoveBoardMemberDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
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

    // Notify removed member (fire-and-forget)
    const actor = await this.userRepository.findById(input.adminUserId);
    const actorName = actor
      ? User.formatFullName(actor.firstName, actor.lastName, actor.middleName)
      : '';
    const organization = await this.organizationRepository.findById(
      board.organizationId
    );

    new NotifyBoardMemberRemovedUseCase({
      notificationRepository: this.notificationRepository,
    })
      .execute({
        removedUserId: input.userId,
        organizationId: board.organizationId,
        organizationName: organization?.name ?? '',
        boardId: board.id,
        boardName: board.name,
        actorName,
      })
      .catch((err) =>
        console.error('Failed to notify board member removed:', err)
      );

    return success(undefined);
  }
}
