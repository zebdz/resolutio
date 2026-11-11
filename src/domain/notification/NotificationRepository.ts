/** Append-only notification persistence accepts validated aggregates and explicit outcomes.
 * Inbox queries and recipient operations have separate ports; producer failures cannot appear as success. */
import type { Notification } from './Notification';
import type { Result } from '../shared/Result';

export type NotificationStorageFailure = 'common.errors.unexpected';
export interface NotificationRepository {
  save(
    notification: Notification
  ): Promise<Result<Notification, NotificationStorageFailure>>;
  saveBatch(
    notifications: Notification[]
  ): Promise<Result<void, NotificationStorageFailure>>;
}
