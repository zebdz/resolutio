import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';
import { User } from '../../domain/user/User';
import { NotifyBoardMemberInviteReceivedUseCase } from '../notification/NotifyBoardMemberInviteReceivedUseCase';

export interface CreateBoardMemberInviteInput {
  boardId: string;
  inviteeId: string;
  actorUserId: string;
}

export interface CreateBoardMemberInviteDependencies {
  invitationRepository: InvitationRepository;
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class CreateBoardMemberInviteUseCase {
  constructor(private deps: CreateBoardMemberInviteDependencies) {}

  async execute(
    input: CreateBoardMemberInviteInput
  ): Promise<Result<Invitation, string>> {
    const { boardId, inviteeId, actorUserId } = input;

    // Check board exists and not archived
    const board = await this.deps.boardRepository.findById(boardId);

    if (!board) {
      return failure(InvitationErrors.BOARD_NOT_FOUND);
    }

    if (board.isArchived()) {
      return failure(InvitationErrors.BOARD_ARCHIVED);
    }

    // Check org exists and not archived
    const organization = await this.deps.organizationRepository.findById(
      board.organizationId
    );

    if (!organization) {
      return failure(InvitationErrors.ORG_NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(InvitationErrors.ORG_ARCHIVED);
    }

    // Check authorization
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        board.organizationId
      );

      if (!isAdmin) {
        return failure(InvitationErrors.NOT_ADMIN);
      }
    }

    // Check invitee exists
    const invitee = await this.deps.userRepository.findById(inviteeId);

    if (!invitee) {
      return failure(InvitationErrors.USER_NOT_FOUND);
    }

    // Check not already board member
    const isAlreadyMember = await this.deps.boardRepository.isUserMember(
      inviteeId,
      boardId
    );

    if (isAlreadyMember) {
      return failure(InvitationErrors.INVITEE_ALREADY_BOARD_MEMBER);
    }

    // Check no pending invite
    const existingInvite =
      await this.deps.invitationRepository.findPendingBoardMemberInvite(
        boardId,
        inviteeId
      );

    if (existingInvite) {
      return failure(InvitationErrors.ALREADY_INVITED);
    }

    // Create and save invitation
    const invitation = Invitation.create(
      board.organizationId,
      actorUserId,
      inviteeId,
      'board_member_invite',
      boardId
    );

    const saved = await this.deps.invitationRepository.save(invitation);

    // Get inviter name for notification
    const inviter = await this.deps.userRepository.findById(actorUserId);
    const inviterName = inviter
      ? User.formatFullName(
          inviter.firstName,
          inviter.lastName,
          inviter.middleName
        )
      : '';

    // Notify invitee (fire-and-forget)
    new NotifyBoardMemberInviteReceivedUseCase({
      notificationRepository: this.deps.notificationRepository,
    })
      .execute({
        invitationId: saved.id,
        organizationId: board.organizationId,
        boardId,
        inviteeUserId: inviteeId,
        inviterName,
        organizationName: organization.name,
        boardName: board.name,
      })
      .catch((err) =>
        console.error('Failed to notify board member invite received:', err)
      );

    return success(saved);
  }
}
