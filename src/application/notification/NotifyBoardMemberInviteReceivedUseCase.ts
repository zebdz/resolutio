import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberInviteReceivedDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyBoardMemberInviteReceivedUseCase {
  constructor(private deps: NotifyBoardMemberInviteReceivedDependencies) {}

  async execute(input: {
    invitationId: string;
    organizationId: string;
    boardId: string;
    inviteeUserId: string;
    inviterName: string;
    organizationName: string;
    boardName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.inviteeUserId,
      type: 'board_member_invite_received',
      title: 'notification.types.boardMemberInviteReceived.title',
      body: 'notification.types.boardMemberInviteReceived.body',
      data: {
        invitationId: input.invitationId,
        organizationId: input.organizationId,
        boardId: input.boardId,
        organizationName: input.organizationName,
        boardName: input.boardName,
        inviterName: input.inviterName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
