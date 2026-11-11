/** Builds admin invite received notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  InvitationId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyAdminInviteReceivedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyAdminInviteReceivedUseCase {
  constructor(private deps: NotifyAdminInviteReceivedDependencies) {}

  async execute(input: {
    invitationId: InvitationId;
    organizationId: OrganizationId;
    inviteeUserId: UserId;
    inviterName: string;
    organizationName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
        userId: input.inviteeUserId,
        type: 'admin_invite_received',
        title: 'notification.types.adminInviteReceived.title',
        body: 'notification.types.adminInviteReceived.body',
        data: {
          invitationId: input.invitationId,
          organizationId: input.organizationId,
          organizationName: input.organizationName,
          inviterName: input.inviterName,
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
