/** Builds board member invite received notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  BoardId,
  InvitationId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';

export interface NotifyBoardMemberInviteReceivedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
}

export class NotifyBoardMemberInviteReceivedUseCase {
  constructor(private deps: NotifyBoardMemberInviteReceivedDependencies) {}

  async execute(input: {
    invitationId: InvitationId;
    organizationId: OrganizationId;
    boardId: BoardId;
    inviteeUserId: UserId;
    inviterName: string;
    organizationName: string;
    boardName: string;
  }): Promise<Result<void, NotificationDeliveryFailure>> {
    const result = Notification.create(
      {
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
