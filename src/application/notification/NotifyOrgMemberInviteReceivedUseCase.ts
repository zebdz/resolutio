/** Builds member invite received notifications with explicit creation identity/time.
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
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgMemberInviteReceivedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyOrgMemberInviteReceivedUseCase {
  constructor(private deps: NotifyOrgMemberInviteReceivedDependencies) {}

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
        type: 'member_invite_received',
        title: 'notification.types.memberInviteReceived.title',
        body: 'notification.types.memberInviteReceived.body',
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
