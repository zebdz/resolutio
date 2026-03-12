import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyInviteRevokedDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyInviteRevokedUseCase {
  constructor(private deps: NotifyInviteRevokedDependencies) {}

  async execute(input: {
    inviteeUserId: string;
    organizationId: string;
    organizationName: string;
    inviteType: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.inviteeUserId,
      type: 'invite_revoked',
      title: 'notification.types.inviteRevoked.title',
      body: 'notification.types.inviteRevoked.body',
      data: {
        organizationId: input.organizationId,
        organizationName: input.organizationName,
        inviteType: input.inviteType,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
