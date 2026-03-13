import { PrismaClient } from '@/generated/prisma/client';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { OrganizationMembershipService } from '../../domain/organization/OrganizationMembershipService';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { User } from '../../domain/user/User';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';
import { AddOrgAdminUseCase } from '../organization/AddOrgAdminUseCase';
import { AddBoardMemberUseCase } from '../board/AddBoardMemberUseCase';
import { NotifyAdminInviteAcceptedUseCase } from '../notification/NotifyAdminInviteAcceptedUseCase';
import { NotifyBoardMemberInviteAcceptedUseCase } from '../notification/NotifyBoardMemberInviteAcceptedUseCase';
import { NotifyOrgMemberInviteAcceptedUseCase } from '../notification/NotifyOrgMemberInviteAcceptedUseCase';
import { NotifyInviteDeclinedUseCase } from '../notification/NotifyInviteDeclinedUseCase';

export interface HandleInviteInput {
  invitationId: string;
  action: 'accept' | 'decline';
  actorUserId: string;
}

export interface HandleInviteDependencies {
  prisma: PrismaClient;
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class HandleInviteUseCase {
  constructor(private deps: HandleInviteDependencies) {}

  async execute(input: HandleInviteInput): Promise<Result<void, string>> {
    const { invitationId, action, actorUserId } = input;

    // Find invitation
    const invitation =
      await this.deps.invitationRepository.findById(invitationId);

    if (!invitation) {
      return failure(InvitationErrors.NOT_FOUND);
    }

    // Check pending
    if (!invitation.isPending()) {
      return failure(InvitationErrors.NOT_PENDING);
    }

    // Check actor is invitee
    if (invitation.inviteeId !== actorUserId) {
      return failure(InvitationErrors.NOT_INVITEE);
    }

    if (action === 'accept') {
      return this.handleAccept(invitation);
    } else {
      invitation.decline();
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins about decline (fire-and-forget)
      const invitee = await this.deps.userRepository.findById(
        invitation.inviteeId
      );
      const inviteeName = invitee
        ? User.formatFullName(
            invitee.firstName,
            invitee.lastName,
            invitee.middleName
          )
        : '';

      new NotifyInviteDeclinedUseCase({
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
          inviteType: invitation.type,
        })
        .catch((err) =>
          console.error('Failed to notify invite declined:', err)
        );

      return success(undefined);
    }
  }

  private async handleAccept(
    invitation: Invitation
  ): Promise<Result<void, string>> {
    const invitee = await this.deps.userRepository.findById(
      invitation.inviteeId
    );
    const inviteeName = invitee
      ? User.formatFullName(
          invitee.firstName,
          invitee.lastName,
          invitee.middleName
        )
      : '';

    if (invitation.type === 'admin_invite') {
      const addResult = await new AddOrgAdminUseCase({
        organizationRepository: this.deps.organizationRepository,
        userRepository: this.deps.userRepository,
      }).execute({
        organizationId: invitation.organizationId,
        targetUserId: invitation.inviteeId,
        actorUserId: invitation.inviterId, // use inviter's authority
      });

      if (!addResult.success) {
        return addResult;
      }

      invitation.accept();
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins (fire-and-forget)
      new NotifyAdminInviteAcceptedUseCase({
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
        })
        .catch((err) =>
          console.error('Failed to notify admin invite accepted:', err)
        );
    } else if (invitation.type === 'board_member_invite') {
      const addResult = await new AddBoardMemberUseCase({
        boardRepository: this.deps.boardRepository,
        organizationRepository: this.deps.organizationRepository,
        userRepository: this.deps.userRepository,
      }).execute({
        boardId: invitation.boardId!,
        userId: invitation.inviteeId,
        adminUserId: invitation.inviterId, // use inviter's authority
      });

      if (!addResult.success) {
        return addResult;
      }

      invitation.accept();
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins + board members (fire-and-forget)
      new NotifyBoardMemberInviteAcceptedUseCase({
        organizationRepository: this.deps.organizationRepository,
        boardRepository: this.deps.boardRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          boardId: invitation.boardId!,
          inviteeName,
        })
        .catch((err) =>
          console.error('Failed to notify board member invite accepted:', err)
        );
    } else if (invitation.type === 'member_invite') {
      // Upsert membership: user may already have a pending/rejected record from a join request
      await this.deps.prisma.organizationUser.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: invitation.inviteeId,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId: invitation.inviteeId,
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedByUserId: invitation.inviterId,
        },
        update: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedByUserId: invitation.inviterId,
        },
      });

      // Remove from hierarchy orgs
      await OrganizationMembershipService.removeUserFromHierarchyOrgs(
        invitation.inviteeId,
        invitation.organizationId,
        this.deps.organizationRepository
      );

      invitation.accept();
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins (fire-and-forget)
      new NotifyOrgMemberInviteAcceptedUseCase({
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
        })
        .catch((err) =>
          console.error('Failed to notify member invite accepted:', err)
        );
    }

    return success(undefined);
  }
}
