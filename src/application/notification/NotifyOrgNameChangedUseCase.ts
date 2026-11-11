/** Builds org name changed notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import { NotificationId, OrganizationId } from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgNameChangedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyOrgNameChangedUseCase {
  constructor(private deps: NotifyOrgNameChangedDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    oldName: string;
    newName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { organizationId, oldName, newName } = input;

    const org = await this.deps.organizationRepository.findById(organizationId);

    if (!org) {
      return success(undefined);
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        organizationId
      );

    if (memberUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      memberUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'org_name_changed',
            title: 'notification.types.orgNameChanged.title',
            body: 'notification.types.orgNameChanged.body',
            data: {
              organizationId,
              oldName,
              newName,
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
