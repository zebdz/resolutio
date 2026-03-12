import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyOrgMemberInviteReceivedDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyOrgMemberInviteReceivedUseCase {
  constructor(private deps: NotifyOrgMemberInviteReceivedDependencies) {}

  async execute(input: {
    invitationId: string;
    organizationId: string;
    inviteeUserId: string;
    inviterName: string;
    organizationName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.inviteeUserId,
      type: 'member_invite_received',
      title: 'notification.types.memberInviteReceived.title',
      body: 'notification.types.memberInviteReceived.body',
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
