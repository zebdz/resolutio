/** Builds invite revoked notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { InvitationType } from '@/domain/invitation/Invitation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyInviteRevokedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyInviteRevokedUseCase {
  constructor(private deps: NotifyInviteRevokedDependencies) {}

  async execute(input: {
    inviteeUserId: UserId;
    organizationId: OrganizationId;
    organizationName: string;
    inviteType: InvitationType;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
        userId: input.inviteeUserId,
        type: 'invite_revoked',
        title: 'notification.types.inviteRevoked.title',
        body: 'notification.types.inviteRevoked.body',
        data: {
          organizationId: input.organizationId,
          organizationName: input.organizationName,
          inviteType: input.inviteType,
        },
      },
      entityCreation(NotificationId, this.deps.ids, this.deps.clock)
    );

    if (!result.success) {
      return result;
    }

    const saved = await this.deps.notificationRepository.save(result.value);

    return saved.success ? success(undefined) : saved;
  }
}
