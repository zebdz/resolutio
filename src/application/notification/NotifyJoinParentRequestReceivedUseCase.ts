import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyJoinParentRequestReceivedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyJoinParentRequestReceivedUseCase {
  constructor(private deps: NotifyJoinParentRequestReceivedDependencies) {}

  async execute(input: {
    childOrgId: string;
    parentOrgId: string;
  }): Promise<void> {
    const { childOrgId, parentOrgId } = input;

    const [childOrg, parentOrg] = await Promise.all([
      this.deps.organizationRepository.findById(childOrgId),
      this.deps.organizationRepository.findById(parentOrgId),
    ]);

    if (!childOrg || !parentOrg) {
      return;
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(parentOrgId);

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
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
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
