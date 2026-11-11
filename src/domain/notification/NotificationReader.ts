/** Inbox query port exposes validated recipient/events and explicit unavailable-state results.
 * Separate from legacy writes so callers cannot mistake storage failures for an empty inbox. */
import type { UserId } from '../shared/EntityIds';
import type { Result } from '../shared/Result';
import type { Notification } from './Notification';
import type {
  NotificationCount,
  NotificationOffset,
} from './NotificationContent';
import type { ResultLimit } from '../shared/Pagination';

export interface FindByUserIdOptions {
  limit?: ResultLimit;
  offset?: NotificationOffset;
}

export type NotificationReadFailure = 'common.errors.unexpected';
export interface NotificationReader {
  findByUserId(
    userId: UserId,
    options?: FindByUserIdOptions
  ): Promise<Result<Notification[], NotificationReadFailure>>;
  getUnreadCount(
    userId: UserId
  ): Promise<Result<NotificationCount, NotificationReadFailure>>;
  getCountByUserId(
    userId: UserId
  ): Promise<Result<NotificationCount, NotificationReadFailure>>;
}
