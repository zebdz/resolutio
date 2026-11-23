/** Builds join request rejected notifications with explicit creation identity/time.
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
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinRequestRejectedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyJoinRequestRejectedUseCase {
  constructor(private deps: NotifyJoinRequestRejectedDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    requesterUserId: UserId;
    rejectionReason: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const organization = await this.deps.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return success(undefined);
    }

    const bodyKey = input.rejectionReason
      ? 'notification.types.joinRequestRejected.bodyWithReason'
      : 'notification.types.joinRequestRejected.body';

    const result = Notification.create(
      {
        userId: input.requesterUserId,
        type: 'join_request_rejected',
        title: 'notification.types.joinRequestRejected.title',
        body: bodyKey,
        data: {
          organizationId: input.organizationId,
          organizationName: organization.name,
          rejectionReason: input.rejectionReason,
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
