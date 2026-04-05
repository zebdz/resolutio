import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyMemberLeftBoardDependencies {
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
}

export class NotifyMemberLeftBoardUseCase {
  constructor(private deps: NotifyMemberLeftBoardDependencies) {}

  async execute(input: {
    organizationId: string;
    organizationName: string;
    boardId: string;
    boardName: string;
    memberName: string;
  }): Promise<void> {
    const { organizationId, organizationName, boardId, boardName, memberName } =
      input;

    const adminUserIds =
      await this.deps.organizationRepository.findAdminUserIds(organizationId);

    if (adminUserIds.length === 0) {
      return;
    }

    const notifications = adminUserIds
      .map((userId) =>
        Notification.create({
          userId,
          type: 'member_left_board',
          title: 'notification.types.memberLeftBoard.title',
          body: 'notification.types.memberLeftBoard.body',
          data: {
            organizationId,
            organizationName,
            boardId,
            boardName,
            memberName,
          },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
