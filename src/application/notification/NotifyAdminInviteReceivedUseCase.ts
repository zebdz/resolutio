import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyAdminInviteReceivedDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyAdminInviteReceivedUseCase {
  constructor(private deps: NotifyAdminInviteReceivedDependencies) {}

  async execute(input: {
    invitationId: string;
    organizationId: string;
    inviteeUserId: string;
    inviterName: string;
    organizationName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.inviteeUserId,
      type: 'admin_invite_received',
      title: 'notification.types.adminInviteReceived.title',
      body: 'notification.types.adminInviteReceived.body',
      data: {
        invitationId: input.invitationId,
        organizationId: input.organizationId,
        organizationName: input.organizationName,
        inviterName: input.inviterName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
