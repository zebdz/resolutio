/** Builds invite declined notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, OrganizationId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { InvitationType } from '@/domain/invitation/Invitation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyInviteDeclinedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyInviteDeclinedUseCase {
  constructor(private deps: NotifyInviteDeclinedDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    inviteeName: string;
    inviteType: InvitationType;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const organization = await this.deps.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return success(undefined);
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(
        input.organizationId
      );

    if (adminUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      adminUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'invite_declined',
            title: 'notification.types.inviteDeclined.title',
            body: 'notification.types.inviteDeclined.body',
            data: {
              organizationId: input.organizationId,
              organizationName: organization.name,
              inviteeName: input.inviteeName,
              inviteType: input.inviteType,
            },
          },
          entityCreation(NotificationId, this.deps.ids, this.deps.clock)
        )
      )
    );

    if (!notifications.success) {
      return notifications;
    }

    return this.deps.notificationRepository.saveBatch(notifications.value);
  }
}
