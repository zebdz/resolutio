/** Builds join parent request received notifications with explicit creation identity/time.
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

export interface NotifyJoinParentRequestReceivedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyJoinParentRequestReceivedUseCase {
  constructor(private deps: NotifyJoinParentRequestReceivedDependencies) {}

  async execute(input: {
    childOrgId: OrganizationId;
    parentOrgId: OrganizationId;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const { childOrgId, parentOrgId } = input;

    const [childOrg, parentOrg] = await Promise.all([
      this.deps.organizationRepository.findById(childOrgId),
      this.deps.organizationRepository.findById(parentOrgId),
    ]);

    if (!childOrg || !parentOrg) {
      return success(undefined);
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(parentOrgId);

    if (adminUserIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      adminUserIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'join_parent_request_received',
            title: 'notification.types.joinParentRequestReceived.title',
            body: 'notification.types.joinParentRequestReceived.body',
            data: {
              childOrgId,
              parentOrgId,
              childOrgName: childOrg.name,
              parentOrgName: parentOrg.name,
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
