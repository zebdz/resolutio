/** Creates an organization invitation after authorization and typed membership checks.
 * Identity/time are supplied explicitly; notifications follow persisted invitations. */
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';
import { z } from 'zod';
import {
  OrganizationId,
  UserId,
  InvitationId,
  BoardId,
} from '@/domain/shared/EntityIds';
import {
  MembershipStore,
  MembershipStoreFailure,
} from '../organization/MembershipStore';
import { MembershipReference } from '../../domain/organization/MembershipPolicy';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';
import { User } from '../../domain/user/User';
import { NotifyOrgMemberInviteReceivedUseCase } from '../notification/NotifyOrgMemberInviteReceivedUseCase';

export interface CreateOrgMemberInviteInput {
  organizationId: string;
  inviteeId: string;
  actorUserId: string;
}

export interface CreateOrgMemberInviteDependencies {
  ids: IdGenerator;
  clock: Clock;
  memberships: Pick<MembershipStore, 'findStatus'>;
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class CreateOrgMemberInviteUseCase {
  constructor(private deps: CreateOrgMemberInviteDependencies) {}

  async execute(
    rawInput: CreateOrgMemberInviteInput
  ): Promise<
    Result<Invitation, InvitationUseCaseFailure | MembershipStoreFailure>
  > {
    const parsed = z
      .object({
        organizationId: OrganizationId,
        inviteeId: UserId,
        actorUserId: UserId,
      })
      .safeParse(rawInput);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...parsed.data };

    const { organizationId, inviteeId, actorUserId } = input;

    // Check org exists and not archived
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

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
        organizationId
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

    // Check not already a member of this org
    const isAlreadyMember = await this.deps.organizationRepository.isUserMember(
      inviteeId,
      organizationId
    );

    if (isAlreadyMember) {
      return failure(InvitationErrors.INVITEE_ALREADY_MEMBER);
    }

    // Check invitee doesn't have a pending join request
    const membership = await this.deps.memberships.findStatus(
      MembershipReference.parse({ organizationId, userId: inviteeId })
    );

    if (!membership.success) {
      return membership;
    }

    if (membership.value === 'pending') {
      return failure(InvitationErrors.INVITEE_HAS_PENDING_REQUEST);
    }

    // Check not member of any org in hierarchy tree
    const hierarchyOrgIds =
      await this.deps.organizationRepository.getFullTreeOrgIds(organizationId);
    const userMemberships =
      await this.deps.organizationRepository.findMembershipsByUserId(inviteeId);
    const inHierarchy = userMemberships.some((org) =>
      hierarchyOrgIds.includes(org.id)
    );

    if (inHierarchy) {
      return failure(InvitationErrors.INVITEE_IN_HIERARCHY);
    }

    // Check no pending invite
    const existingInvite =
      await this.deps.invitationRepository.findPendingMemberInvite(
        organizationId,
        inviteeId
      );

    if (existingInvite) {
      return failure(InvitationErrors.ALREADY_INVITED);
    }

    // Create and save invitation
    const invitation = Invitation.create(
      organizationId,
      actorUserId,
      inviteeId,
      { type: 'member_invite', boardId: null },
      entityCreation(InvitationId, this.deps.ids, this.deps.clock)
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
    new NotifyOrgMemberInviteReceivedUseCase({
      ids: this.deps.ids,
      clock: this.deps.clock,
      notificationRepository: this.deps.notificationRepository,
    })
      .execute({
        invitationId: saved.id,
        organizationId,
        inviteeUserId: inviteeId,
        inviterName,
        organizationName: organization.name,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyOrgMemberInviteReceivedUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) =>
        console.error('Failed to notify member invite received:', err)
      );

    return success(saved);
  }
}
