/** Marks the recipient's unread notifications at an explicitly supplied instant.
 * Persistence failures propagate through the signature instead of appearing as success. */
import { NotificationFailure } from './NotificationErrors';
import { Clock } from '@/application/shared/EntityCreation';
// Decode the recipient before invoking notification persistence.
import { UserId } from '@/domain/shared/EntityIds';
import type { NotificationRecipientRepository } from '../../domain/notification/NotificationRecipientRepository';
import { Result, failure } from '../../domain/shared/Result';

export interface MarkAllNotificationsReadDependencies {
  clock: Clock;
  notificationRepository: Pick<
    NotificationRecipientRepository,
    'markAllAsRead'
  >;
}

export class MarkAllNotificationsReadUseCase {
  constructor(private deps: MarkAllNotificationsReadDependencies) {}

  async execute(input: {
    userId: string;
  }): Promise<Result<void, NotificationFailure>> {
    const userId = UserId.safeParse(input.userId);

    if (!userId.success) {
      return failure('common.errors.validationFailed');
    }

    return this.deps.notificationRepository.markAllAsRead(
      userId.data,
      this.deps.clock.now()
    );
  }
}
