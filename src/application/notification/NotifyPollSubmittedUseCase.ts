/** Builds poll submitted notifications with explicit creation identity/time.
 * Construction and storage failures return Results; an empty audience succeeds. */
import { success, collectResults, type Result } from '@/domain/shared/Result';
import type { NotificationDeliveryFailure } from './NotificationErrors';
import {
  NotificationId,
  OrganizationId,
  PollId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  IdGenerator,
  Clock,
  entityCreation,
} from '@/application/shared/EntityCreation';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';

export interface NotifyPollSubmittedDependencies {
  ids: IdGenerator;
  clock: Clock;
  notificationRepository: Pick<NotificationRepository, 'save' | 'saveBatch'>;
  organizationRepository: OrganizationRepository;
}

export interface NotifyPollSubmittedInput {
  pollId: PollId;
  pollTitle: string;
  organizationId: OrganizationId;
  /**
   * The author. Excluded from the recipients: an admin submitting their own
   * poll would otherwise be told about it by themselves.
   */
  submittedByUserId: UserId;
}

/**
 * Tells an organization's admins that a poll is waiting for them.
 *
 * Without it "send to admin" sends nothing anywhere, and the handover depends
 * on someone happening to look at the poll list.
 */
export class NotifyPollSubmittedUseCase {
  constructor(private deps: NotifyPollSubmittedDependencies) {}

  async execute(
    input: NotifyPollSubmittedInput
  ): Promise<Result<void, NotificationDeliveryFailure>> {
    const adminIds = await this.deps.organizationRepository.getAdminUserIds(
      input.organizationId
    );

    const recipients = adminIds.filter((id) => id !== input.submittedByUserId);

    if (recipients.length === 0) {
      return success(undefined);
    }

    const notifications = collectResults(
      recipients.map((userId) =>
        Notification.create(
          {
            userId,
            type: 'poll_submitted',
            title: 'notification.types.pollSubmitted.title',
            body: 'notification.types.pollSubmitted.body',
            data: { pollId: input.pollId, pollTitle: input.pollTitle },
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
