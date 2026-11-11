/** Builds admin removed notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
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
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';

export interface NotifyAdminRemovedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyAdminRemovedUseCase {
  constructor(private deps: NotifyAdminRemovedDependencies) {}

  async execute(input: {
    removedUserId: UserId;
    organizationId: OrganizationId;
    organizationName: string;
    actorName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
        userId: input.removedUserId,
        type: 'admin_removed',
        title: 'notification.types.adminRemoved.title',
        body: 'notification.types.adminRemoved.body',
        data: {
          organizationId: input.organizationId,
          organizationName: input.organizationName,
          actorName: input.actorName,
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
