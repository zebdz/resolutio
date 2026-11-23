/** Decodes invitation request references before authorization and domain transitions. */
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { Instant } from '@/domain/shared/Instant';
import { z } from 'zod';
import { InvitationId, UserId, BoardId } from '@/domain/shared/EntityIds';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';
import { NotifyInviteRevokedUseCase } from '../notification/NotifyInviteRevokedUseCase';

export interface RevokeInviteInput {
  invitationId: string;
  actorUserId: string;
}

export interface RevokeInviteDependencies {
  ids: IdGenerator;
  clock: Clock;
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notificationRepository: NotificationRepository;
}

export class RevokeInviteUseCase {
  constructor(private deps: RevokeInviteDependencies) {}

  async execute(
    rawInput: RevokeInviteInput
  ): Promise<Result<void, InvitationUseCaseFailure>> {
    const parsed = z
      .object({ invitationId: InvitationId, actorUserId: UserId })
      .safeParse(rawInput);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...parsed.data };

    const { invitationId, actorUserId } = input;

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

    // Check authorization: superadmin or org admin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        invitation.organizationId
      );

      if (!isAdmin) {
        return failure(InvitationErrors.NOT_ADMIN);
      }
    }

    // Revoke
    invitation.revoke(this.deps.clock.now());
    await this.deps.invitationRepository.update(invitation);

    // Get org name for notification
    const organization = await this.deps.organizationRepository.findById(
      invitation.organizationId
    );

    // Notify invitee (fire-and-forget)
    new NotifyInviteRevokedUseCase({
      ids: this.deps.ids,
      clock: this.deps.clock,
      notificationRepository: this.deps.notificationRepository,
    })
      .execute({
        inviteeUserId: invitation.inviteeId,
        organizationId: invitation.organizationId,
        organizationName: organization?.name || '',
        inviteType: invitation.type,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyInviteRevokedUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) => console.error('Failed to notify invite revoked:', err));

    return success(undefined);
  }
}
