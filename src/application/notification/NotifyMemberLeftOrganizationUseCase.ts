import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberLeftOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftOrganizationUseCase {
  constructor(private deps: NotifyMemberLeftOrganizationDependencies) {}

  async execute(input: {
    organizationId: string;
    organizationName: string;
    memberName: string;
  }): Promise<void> {
    const { organizationId, organizationName, memberName } = input;

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(organizationId);

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'member_left_organization',
          title: 'notification.types.memberLeftOrganization.title',
          body: 'notification.types.memberLeftOrganization.body',
          data: { organizationId, organizationName, memberName },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
