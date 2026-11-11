/** Builds board member invite accepted notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  BoardId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberInviteAcceptedDependencies {
  ids: IdGenerator;
  clock: Clock;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyBoardMemberInviteAcceptedUseCase {
  constructor(private deps: NotifyBoardMemberInviteAcceptedDependencies) {}

  async execute(input: {
    organizationId: OrganizationId;
    boardId: BoardId;
    inviteeName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const [organization, board] = await Promise.all([
      this.deps.organizationRepository.findById(input.organizationId),
      this.deps.boardRepository.findById(input.boardId),
    ]);

    if (!organization || !board) {
      return success(undefined);
    }

    const [adminUserIds, boardMembers] = await Promise.all([
      this.deps.organizationRepository.findAdminUserIds(input.organizationId),
      this.deps.boardRepository.findBoardMembers(input.boardId),
    ]);

    const boardMemberUserIds = boardMembers.map((m) => m.userId);
    const recipientIds = [...new Set([...adminUserIds, ...boardMemberUserIds])];

    if (recipientIds.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      recipientIds.map((userId) =>
        Notification.create(
          {
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
          },
          entityCreation(NotificationId, this.deps.ids, this.deps.clock)
        )
      )
    );

    if (!notifications.success) {
      return notifications;
    }

    return this.deps.notificationRepository.saveBatch(notifications.value);
  }
}
