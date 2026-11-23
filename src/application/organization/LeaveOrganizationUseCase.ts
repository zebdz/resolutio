/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import { OrganizationId, UserId, BoardId } from '../../domain/shared/EntityIds';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftOrganizationUseCase } from '../notification/NotifyMemberLeftOrganizationUseCase';

export interface LeaveOrganizationInput {
  userId: string;
  organizationId: string;
  boardIdsToLeave: string[];
}

export interface LeaveOrganizationDependencies {
  clock: Clock;
  ids: IdGenerator;
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveOrganizationUseCase {
  private clock: Clock;
  private ids: IdGenerator;
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveOrganizationDependencies) {
    this.clock = dependencies.clock;
    this.ids = dependencies.ids;
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(
    input: LeaveOrganizationInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedUserId = UserId.safeParse(input.userId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const parsedBoards = BoardId.array().safeParse(input.boardIdsToLeave);

    if (!parsedBoards.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const command = {
      ...input,
      boardIdsToLeave: parsedBoards.data,
      organizationId: parsedOrganizationId.data,
      userId: parsedUserId.data,
    };

    // Find organization
    const organization = await this.organizationRepository.findById(
      command.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check if archived
    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check membership
    const isMember = await this.organizationRepository.isUserMember(
      command.userId,
      command.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Leave selected boards (skip non-existent/archived/non-member)
    for (const boardId of command.boardIdsToLeave) {
      const board = await this.boardRepository.findById(boardId);

      if (!board || board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        command.userId,
        boardId
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        command.userId,
        boardId,
        command.userId,
        'left_voluntarily'
      );
    }

    // Hard-delete org membership
    await this.organizationRepository.removeUserFromOrganization(
      command.userId,
      command.organizationId
    );

    // Fire-and-forget notification to org admins
    const user = await this.userRepository.findById(command.userId);
    const memberName = user
      ? User.formatFullName(user.firstName, user.lastName, user.middleName)
      : '';

    new NotifyMemberLeftOrganizationUseCase({
      ids: this.ids,
      clock: this.clock,
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        organizationId: command.organizationId,
        organizationName: organization.name,
        memberName,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyMemberLeftOrganizationUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) =>
        console.error('Failed to notify member left organization:', err)
      );

    return success(undefined);
  }
}
