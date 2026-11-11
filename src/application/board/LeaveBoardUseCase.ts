/** LeaveBoard application flow decodes request identities before domain/repository use.
 * Authorization and persistence stay coordinated here; lifecycle decisions belong to Board. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import { z } from 'zod';
import { BoardId, UserId } from '@/domain/shared/EntityIds';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors, BoardUseCaseError } from './BoardErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftBoardUseCase } from '../notification/NotifyMemberLeftBoardUseCase';

/** Raw request values, decoded once at the application boundary. */
export interface LeaveBoardInput {
  userId: string;
  boardId: string;
}

const request = z.object({
  boardId: BoardId,
  userId: UserId,
});

export interface LeaveBoardDependencies {
  clock: Clock;
  ids: IdGenerator;
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveBoardUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveBoardDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(
    rawInput: LeaveBoardInput
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
      ids: this.ids,
      clock: this.clock,
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
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyMemberLeftBoardUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) =>
        console.error('Failed to notify member left board:', err)
      );

    return success(undefined);
  }
}
