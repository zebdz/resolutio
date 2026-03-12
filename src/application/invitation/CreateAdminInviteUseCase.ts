import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';
import { User } from '../../domain/user/User';
import { NotifyAdminInviteReceivedUseCase } from '../notification/NotifyAdminInviteReceivedUseCase';

export interface CreateAdminInviteInput {
  organizationId: string;
  inviteeId: string;
  actorUserId: string;
}

export interface CreateAdminInviteDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class CreateAdminInviteUseCase {
  constructor(private deps: CreateAdminInviteDependencies) {}

  async execute(
    input: CreateAdminInviteInput
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

    // Check not already admin
    const isAlreadyAdmin = await this.deps.organizationRepository.isUserAdmin(
      inviteeId,
      organizationId
    );

    if (isAlreadyAdmin) {
      return failure(InvitationErrors.INVITEE_ALREADY_ADMIN);
    }

    // Check no pending invite
    const existingInvite =
      await this.deps.invitationRepository.findPendingAdminInvite(
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
      'admin_invite'
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
    new NotifyAdminInviteReceivedUseCase({
      organizationRepository: this.deps.organizationRepository,
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
        console.error('Failed to notify admin invite received:', err)
      );

    return success(saved);
  }
}
