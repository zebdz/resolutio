/** Reads the validated recipient's authoritative unread count through an explicit Result.
 * Storage/decoding failures propagate instead of appearing as a successful zero count. */
import { NotificationFailure } from './NotificationErrors';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import { UserId } from '@/domain/shared/EntityIds';
import type { NotificationReader } from '../../domain/notification/NotificationReader';
import { Result, success, failure } from '../../domain/shared/Result';

export interface GetUnreadNotificationCountDependencies {
  notificationReader: Pick<NotificationReader, 'getUnreadCount'>;
}

export class GetUnreadNotificationCountUseCase {
  constructor(private deps: GetUnreadNotificationCountDependencies) {}

  async execute(input: {
    userId: string;
  }): Promise<Result<{ count: NotificationCount }, NotificationFailure>> {
    const userId = UserId.safeParse(input.userId);

    if (!userId.success) {
      return failure('common.errors.validationFailed');
    }

    const count = await this.deps.notificationReader.getUnreadCount(
      userId.data
    );

    return count.success ? success({ count: count.value }) : count;
  }
}
