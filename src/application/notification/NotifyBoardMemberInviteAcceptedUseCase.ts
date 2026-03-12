import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberInviteAcceptedDependencies {
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyBoardMemberInviteAcceptedUseCase {
  constructor(private deps: NotifyBoardMemberInviteAcceptedDependencies) {}

  async execute(input: {
    organizationId: string;
    boardId: string;
    inviteeName: string;
  }): Promise<void> {
    const [organization, board] = await Promise.all([
      this.deps.organizationRepository.findById(input.organizationId),
      this.deps.boardRepository.findById(input.boardId),
    ]);

    if (!organization || !board) {
      return;
    }

    const [adminUserIds, boardMembers] = await Promise.all([
      this.deps.organizationRepository.findAdminUserIds(input.organizationId),
      this.deps.boardRepository.findBoardMembers(input.boardId),
    ]);

    const boardMemberUserIds = boardMembers.map((m) => m.userId);
    const recipientIds = [...new Set([...adminUserIds, ...boardMemberUserIds])];

    if (recipientIds.length === 0) {
      return;
    }

    const notifications = recipientIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'board_member_invite_accepted',
          title: 'notification.types.boardMemberInviteAccepted.title',
          body: 'notification.types.boardMemberInviteAccepted.body',
          data: {
            organizationId: input.organizationId,
            boardId: input.boardId,
            organizationName: organization.name,
            boardName: board.name,
            inviteeName: input.inviteeName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
