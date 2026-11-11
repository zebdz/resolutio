/** Builds member removed from organization notifications with explicit creation identity/time.
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
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberRemovedFromOrganizationDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyMemberRemovedFromOrganizationUseCase {
  constructor(private deps: NotifyMemberRemovedFromOrganizationDependencies) {}

  async execute(input: {
    removedUserId: UserId;
    organizationId: OrganizationId;
    organizationName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
        userId: input.removedUserId,
        type: 'member_removed_from_organization',
        title: 'notification.types.memberRemovedFromOrganization.title',
        body: 'notification.types.memberRemovedFromOrganization.body',
        data: {
          organizationId: input.organizationId,
          organizationName: input.organizationName,
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
