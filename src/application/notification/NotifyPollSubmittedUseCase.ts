import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { Notification } from '../../domain/notification/Notification';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';

export interface NotifyPollSubmittedDependencies {
  notificationRepository: NotificationRepository;
  organizationRepository: OrganizationRepository;
}

export interface NotifyPollSubmittedInput {
  pollId: string;
  pollTitle: string;
  organizationId: string;
  /**
   * The author. Excluded from the recipients: an admin submitting their own
   * poll would otherwise be told about it by themselves.
   */
  submittedByUserId: string;
}

/**
 * Tells an organization's admins that a poll is waiting for them.
 *
 * Without it "send to admin" sends nothing anywhere, and the handover depends
 * on someone happening to look at the poll list.
 */
export class NotifyPollSubmittedUseCase {
  constructor(private deps: NotifyPollSubmittedDependencies) {}

  async execute(input: NotifyPollSubmittedInput): Promise<void> {
    const adminIds = await this.deps.organizationRepository.getAdminUserIds(
      input.organizationId
    );

    const recipients = adminIds.filter((id) => id !== input.submittedByUserId);

    if (recipients.length === 0) {
      return;
    }

    const notifications = recipients
      .map((userId) =>
        Notification.create({
          userId,
          type: 'poll_submitted',
          title: 'notification.types.pollSubmitted.title',
          body: 'notification.types.pollSubmitted.body',
          data: { pollId: input.pollId, pollTitle: input.pollTitle },
        })
      )
      .filter((r) => r.success)
      .map((r) => (r as { success: true; value: Notification }).value);

    await this.deps.notificationRepository.saveBatch(notifications);
  }
}
