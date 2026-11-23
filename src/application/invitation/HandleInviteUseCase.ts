/** Authorizes invitation decisions and coordinates their context-specific effects.
 * Membership acceptance receives explicit actor/time through the membership port. */
import { OrganizationUseCaseFailure } from '../organization/OrganizationErrors';
import { BoardUseCaseError } from '../board/BoardErrors';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { z } from 'zod';
import { InvitationId, UserId, BoardId } from '@/domain/shared/EntityIds';
import { MembershipStore } from '../organization/MembershipStore';
import {
  MembershipReference,
  acceptInvitedMembership,
} from '../../domain/organization/MembershipPolicy';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { OrganizationMembershipService } from '../organization/OrganizationMembershipService';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { User } from '../../domain/user/User';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';
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
  ids: IdGenerator;
  clock: Clock;
  memberships: Pick<MembershipStore, 'acceptInvitation'>;
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class HandleInviteUseCase {
  constructor(private deps: HandleInviteDependencies) {}

  async execute(
    rawInput: HandleInviteInput
  ): Promise<
    Result<
      void,
      InvitationUseCaseFailure | OrganizationUseCaseFailure | BoardUseCaseError
    >
  > {
    const parsed = z
      .object({
        invitationId: InvitationId,
        actorUserId: UserId,
        action: z.enum(['accept', 'decline']),
      })
      .safeParse(rawInput);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...parsed.data };

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
      invitation.decline(this.deps.clock.now());
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
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
          inviteType: invitation.type,
        })
        .then((outcome) => {
          if (!outcome.success) {
            console.error(
              'Notification delivery failed (NotifyInviteDeclinedUseCase):',
              outcome.error
            );
          }
        })
        .catch((err) =>
          console.error('Failed to notify invite declined:', err)
        );

      return success(undefined);
    }
  }

  private async handleAccept(
    invitation: Invitation
  ): Promise<
    Result<
      void,
      InvitationUseCaseFailure | OrganizationUseCaseFailure | BoardUseCaseError
    >
  > {
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

      invitation.accept(this.deps.clock.now());
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins (fire-and-forget)
      new NotifyAdminInviteAcceptedUseCase({
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
        })
        .then((outcome) => {
          if (!outcome.success) {
            console.error(
              'Notification delivery failed (NotifyAdminInviteAcceptedUseCase):',
              outcome.error
            );
          }
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

      invitation.accept(this.deps.clock.now());
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins + board members (fire-and-forget)
      new NotifyBoardMemberInviteAcceptedUseCase({
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        boardRepository: this.deps.boardRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          boardId: invitation.boardId!,
          inviteeName,
        })
        .then((outcome) => {
          if (!outcome.success) {
            console.error(
              'Notification delivery failed (NotifyBoardMemberInviteAcceptedUseCase):',
              outcome.error
            );
          }
        })
        .catch((err) =>
          console.error('Failed to notify board member invite accepted:', err)
        );
    } else if (invitation.type === 'member_invite') {
      // Upsert membership: user may already have a pending/rejected record from a join request.
      const acceptedAt = this.deps.clock.now();
      const saved = await this.deps.memberships.acceptInvitation(
        MembershipReference.parse({
          organizationId: invitation.organizationId,
          userId: invitation.inviteeId,
        }),
        acceptInvitedMembership(invitation.inviterId, acceptedAt)
      );

      if (!saved.success) {
        return saved;
      }

      // Remove from hierarchy orgs (unless multi-membership allowed)
      const allowsMulti =
        await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
          invitation.organizationId
        );

      if (!allowsMulti) {
        await OrganizationMembershipService.removeUserFromHierarchyOrgs(
          invitation.inviteeId,
          invitation.organizationId,
          this.deps.organizationRepository
        );
      }

      invitation.accept(acceptedAt);
      await this.deps.invitationRepository.update(invitation);

      // Notify org admins (fire-and-forget)
      new NotifyOrgMemberInviteAcceptedUseCase({
        ids: this.deps.ids,
        clock: this.deps.clock,
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      })
        .execute({
          organizationId: invitation.organizationId,
          inviteeName,
        })
        .then((outcome) => {
          if (!outcome.success) {
            console.error(
              'Notification delivery failed (NotifyOrgMemberInviteAcceptedUseCase):',
              outcome.error
            );
          }
        })
        .catch((err) =>
          console.error('Failed to notify member invite accepted:', err)
        );
    }

    return success(undefined);
  }
}
