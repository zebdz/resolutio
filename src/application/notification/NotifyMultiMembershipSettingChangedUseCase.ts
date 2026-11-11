/** Builds multi membership setting changed notifications with explicit creation identity/time.
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

export interface NotifyMultiMembershipSettingChangedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyMultiMembershipSettingChangedUseCase {
  constructor(private deps: NotifyMultiMembershipSettingChangedDependencies) {}

  async execute(input: {
    rootOrgId: OrganizationId;
    allowed: boolean;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { rootOrgId, allowed } = input;

    const rootOrg = await this.deps.organizationRepository.findById(rootOrgId);

    if (!rootOrg) {
      return success(undefined);
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        rootOrgId
      );

    if (memberUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      memberUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'multi_membership_setting_changed',
            title: 'notification.types.multiMembershipSettingChanged.title',
            body: 'notification.types.multiMembershipSettingChanged.body',
            data: {
              organizationId: rootOrgId,
              organizationName: rootOrg.name,
              allowed,
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
