import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgNameChangedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyOrgNameChangedUseCase {
  constructor(private deps: NotifyOrgNameChangedDependencies) {}

  async execute(input: {
    organizationId: string;
    oldName: string;
    newName: string;
  }): Promise<void> {
    const { organizationId, oldName, newName } = input;

    const org = await this.deps.organizationRepository.findById(organizationId);

    if (!org) {
      return;
    }

    const memberUserIds =
      await this.deps.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
        organizationId
      );

    if (memberUserIds.length === 0) {
      return;
    }

    const notifications = memberUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'org_name_changed',
          title: 'notification.types.orgNameChanged.title',
          body: 'notification.types.orgNameChanged.body',
          data: {
            organizationId,
            oldName,
            newName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
