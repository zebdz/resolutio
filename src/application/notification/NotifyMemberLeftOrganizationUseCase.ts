/** Builds member left organization notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, OrganizationId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberLeftOrganizationDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyMemberLeftOrganizationUseCase {
  constructor(private deps: NotifyMemberLeftOrganizationDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    organizationName: string;
    memberName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { organizationId, organizationName, memberName } = input;

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(organizationId);

    if (adminUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      adminUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'member_left_organization',
            title: 'notification.types.memberLeftOrganization.title',
            body: 'notification.types.memberLeftOrganization.body',
            data: { organizationId, organizationName, memberName },
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
