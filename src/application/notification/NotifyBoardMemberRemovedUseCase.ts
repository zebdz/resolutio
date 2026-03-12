import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberRemovedDependencies {
  notificationRepository: NotificationRepository;
}

export class NotifyBoardMemberRemovedUseCase {
  constructor(private deps: NotifyBoardMemberRemovedDependencies) {}

  async execute(input: {
    removedUserId: string;
    organizationId: string;
    organizationName: string;
    boardId: string;
    boardName: string;
    actorName: string;
  }): Promise<void> {
    const result = Notification.create({
      userId: input.removedUserId,
      type: 'board_member_removed',
      title: 'notification.types.boardMemberRemoved.title',
      body: 'notification.types.boardMemberRemoved.body',
      data: {
        organizationId: input.organizationId,
        organizationName: input.organizationName,
        boardId: input.boardId,
        boardName: input.boardName,
        actorName: input.actorName,
      },
    });

    if (result.success) {
      await this.deps.notificationRepository.save(result.value);
    }
  }
}
