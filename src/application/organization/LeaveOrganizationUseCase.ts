import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { User } from '../../domain/user/User';
import { NotifyMemberLeftOrganizationUseCase } from '../notification/NotifyMemberLeftOrganizationUseCase';

export interface LeaveOrganizationInput {
  userId: string;
  organizationId: string;
  boardIdsToLeave: string[];
}

export interface LeaveOrganizationDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class LeaveOrganizationUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private notificationRepository: NotificationRepository;

  constructor(dependencies: LeaveOrganizationDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.notificationRepository = dependencies.notificationRepository;
  }

  async execute(input: LeaveOrganizationInput): Promise<Result<void, string>> {
    // Find organization
    const organization = await this.organizationRepository.findById(
      input.organizationId
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
      input.userId,
      input.organizationId
    );

    if (!isMember) {
      return failure(OrganizationErrors.NOT_MEMBER);
    }

    // Leave selected boards (skip non-existent/archived/non-member)
    for (const boardId of input.boardIdsToLeave) {
      const board = await this.boardRepository.findById(boardId);

      if (!board || board.isArchived()) {
        continue;
      }

      const isBoardMember = await this.boardRepository.isUserMember(
        input.userId,
        boardId
      );

      if (!isBoardMember) {
        continue;
      }

      await this.boardRepository.removeUserFromBoard(
        input.userId,
        boardId,
        input.userId,
        'left_voluntarily'
      );
    }

    // Hard-delete org membership
    await this.organizationRepository.removeUserFromOrganization(
      input.userId,
      input.organizationId
    );

    // Fire-and-forget notification to org admins
    const user = await this.userRepository.findById(input.userId);
    const memberName = user
      ? User.formatFullName(user.firstName, user.lastName, user.middleName)
      : '';

    new NotifyMemberLeftOrganizationUseCase({
      organizationRepository: this.organizationRepository,
      notificationRepository: this.notificationRepository,
    })
      .execute({
        organizationId: input.organizationId,
        organizationName: organization.name,
        memberName,
      })
      .catch((err) =>
        console.error('Failed to notify member left organization:', err)
      );

    return success(undefined);
  }
}
