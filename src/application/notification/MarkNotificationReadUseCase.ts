/** Authorizes the recipient before applying an idempotent read transition.
 * Failed loads/writes propagate explicitly; recipient-scoped persistence retains the first read time. */
import { NotificationFailure } from './NotificationErrors';
import { NotificationId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock } from '@/application/shared/EntityCreation';
import { z } from 'zod';
import type { NotificationRecipientRepository } from '../../domain/notification/NotificationRecipientRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { NotificationErrors } from './NotificationErrors';

export interface MarkNotificationReadDependencies {
  clock: Clock;
  notificationRepository: Pick<
    NotificationRecipientRepository,
    'findById' | 'markAsRead'
  >;
}

export class MarkNotificationReadUseCase {
  constructor(private deps: MarkNotificationReadDependencies) {}

  async execute(input: {
    notificationId: string;
    userId: string;
  }): Promise<Result<void, NotificationFailure>> {
    const parsed = z
      .object({ notificationId: NotificationId, userId: UserId })
      .safeParse(input);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const { notificationId, userId } = parsed.data;

    const loaded =
      await this.deps.notificationRepository.findById(notificationId);

    if (!loaded.success) {
      return loaded;
    }

    const notification = loaded.value;

    if (!notification) {
      return failure(NotificationErrors.NOT_FOUND);
    }

    if (notification.userId !== userId) {
      return failure(NotificationErrors.NOT_OWNER);
    }

    notification.markAsRead(this.deps.clock.now());
    const readAt = notification.readAt;

    if (readAt !== null) {
      return this.deps.notificationRepository.markAsRead(
        notificationId,
        userId,
        Instant.fromDate(readAt)
      );
    }

    return success(undefined);
  }
}
