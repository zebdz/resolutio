import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgUnarchivedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyOrgUnarchivedUseCase {
  constructor(private deps: NotifyOrgUnarchivedDependencies) {}

  async execute(input: { organizationId: string }): Promise<void> {
    const { organizationId } = input;

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
          type: 'org_unarchived',
          title: 'notification.types.orgUnarchived.title',
          body: 'notification.types.orgUnarchived.body',
          data: {
            organizationId,
            organizationName: org.name,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
