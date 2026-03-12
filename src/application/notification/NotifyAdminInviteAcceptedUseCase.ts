import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyAdminInviteAcceptedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyAdminInviteAcceptedUseCase {
  constructor(private deps: NotifyAdminInviteAcceptedDependencies) {}

  async execute(input: {
    organizationId: string;
    inviteeName: string;
  }): Promise<void> {
    const organization = await this.deps.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return;
    }

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(
        input.organizationId
      );

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'admin_invite_accepted',
          title: 'notification.types.adminInviteAccepted.title',
          body: 'notification.types.adminInviteAccepted.body',
          data: {
            organizationId: input.organizationId,
            organizationName: organization.name,
            inviteeName: input.inviteeName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
