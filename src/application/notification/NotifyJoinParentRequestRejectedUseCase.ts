import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinParentRequestRejectedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyJoinParentRequestRejectedUseCase {
  constructor(private deps: NotifyJoinParentRequestRejectedDependencies) {}

  async execute(input: {
    childOrgId: string;
    parentOrgId: string;
    rejectionReason: string;
  }): Promise<void> {
    const { childOrgId, parentOrgId, rejectionReason } = input;

    const [childOrg, parentOrg] = await Promise.all([
      this.deps.organizationRepository.findById(childOrgId),
      this.deps.organizationRepository.findById(parentOrgId),
    ]);

    if (!childOrg || !parentOrg) {
      return;
    }

    const [memberUserIds, adminUserIds] = await Promise.all([
      this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        childOrgId
      ),
      this.deps.organizationRepository.findAdminUserIds(childOrgId),
    ]);

    const recipientIds = [...new Set([...memberUserIds, ...adminUserIds])];

    if (recipientIds.length === 0) {
      return;
    }

    const bodyKey = rejectionReason
      ? 'notification.types.joinParentRequestRejected.bodyWithReason'
      : 'notification.types.joinParentRequestRejected.body';

    const notifications = recipientIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'join_parent_request_rejected',
          title: 'notification.types.joinParentRequestRejected.title',
          body: bodyKey,
          data: {
            childOrgId,
            parentOrgId,
            childOrgName: childOrg.name,
            parentOrgName: parentOrg.name,
            rejectionReason,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
