import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyInviteDeclinedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyInviteDeclinedUseCase {
  constructor(private deps: NotifyInviteDeclinedDependencies) {}

  async execute(input: {
    organizationId: string;
    inviteeName: string;
    inviteType: string;
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
          type: 'invite_declined',
          title: 'notification.types.inviteDeclined.title',
          body: 'notification.types.inviteDeclined.body',
          data: {
            organizationId: input.organizationId,
            organizationName: organization.name,
            inviteeName: input.inviteeName,
            inviteType: input.inviteType,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
