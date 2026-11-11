/** Builds board member removed notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  BoardId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberRemovedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyBoardMemberRemovedUseCase {
  constructor(private deps: NotifyBoardMemberRemovedDependencies) {}

  async execute(input: {
    removedUserId: UserId;
    organizationId: OrganizationId;
    organizationName: string;
    boardId: BoardId;
    boardName: string;
    actorName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
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
      },
      entityCreation(NotificationId, this.deps.ids, this.deps.clock)
    );

    if (!result.success) {
      return result;
    }

    const saved = await this.deps.notificationRepository.save(result.value);

    return saved.success ? success(undefined) : saved;
  }
}
