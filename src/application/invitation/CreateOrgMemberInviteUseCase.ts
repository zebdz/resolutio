import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';
import { User } from '../../domain/user/User';
import { NotifyOrgMemberInviteReceivedUseCase } from '../notification/NotifyOrgMemberInviteReceivedUseCase';

export interface CreateOrgMemberInviteInput {
  organizationId: string;
  inviteeId: string;
  actorUserId: string;
}

export interface CreateOrgMemberInviteDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class CreateOrgMemberInviteUseCase {
  constructor(private deps: CreateOrgMemberInviteDependencies) {}

  async execute(
    input: CreateOrgMemberInviteInput
  ): Promise<Result<Invitation, string>> {
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
      'member_invite'
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
      notificationRepository: this.deps.notificationRepository,
    })
      .execute({
        invitationId: saved.id,
        organizationId,
        inviteeUserId: inviteeId,
        inviterName,
        organizationName: organization.name,
      })
      .catch((err) =>
        console.error('Failed to notify member invite received:', err)
      );

    return success(saved);
  }
}
