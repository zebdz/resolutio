import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftBoardUseCase } from '../notification/NotifyMemberLeftBoardUseCase';

export interface LeaveBoardInput {
  userId: string;
  boardId: string;
}

export interface LeaveBoardDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveBoardUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveBoardDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: LeaveBoardInput): Promise<Result<void, string>> {
    // Find the board
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    // Check if board is archived
    if (board.isArchived()) {
      return failure(BoardErrors.BOARD_ARCHIVED);
    }

    // Check if user is a member of the board
    const isMember = await this.boardRepository.isUserMember(
      input.userId,
      input.boardId
    );

    if (!isMember) {
      return failure(BoardErrors.NOT_MEMBER);
    }

    // Remove user from board (removedBy = self)
    await this.boardRepository.removeUserFromBoard(
      input.userId,
      input.boardId,
      input.userId,
      'left_voluntarily'
    );

    // Fire-and-forget notification
    const user = await this.userRepository.findById(input.userId);
    const memberName = user
      ? User.formatFullName(user.firstName, user.lastName, user.middleName)
      : '';
    const organization = await this.organizationRepository.findById(
      board.organizationId
    );

    new NotifyMemberLeftBoardUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        organizationId: board.organizationId,
        organizationName: organization?.name ?? '',
        boardId: board.id,
        boardName: board.name,
        memberName,
      })
      .catch((err) =>
        console.error('Failed to notify member left board:', err)
      );

    return success(undefined);
  }
}
