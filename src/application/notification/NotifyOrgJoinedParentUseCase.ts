/** Builds org joined parent notifications with explicit creation identity/time.
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

export interface NotifyOrgJoinedParentDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyOrgJoinedParentUseCase {
  constructor(private deps: NotifyOrgJoinedParentDependencies) {}

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

    const [memberUserIds, adminUserIds] = await Promise.all([
      this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        childOrgId
      ),
      this.deps.organizationRepository.findAdminUserIds(childOrgId),
    ]);

    const recipientIds = [...new Set([...memberUserIds, ...adminUserIds])];

    if (recipientIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      recipientIds.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'org_joined_parent',
            title: 'notification.types.orgJoinedParent.title',
            body: 'notification.types.orgJoinedParent.body',
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
