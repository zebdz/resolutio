/** Recipient operations load validated notifications and expose read/delete failures explicitly.
 * Writes require both notification and recipient identities; read timestamps remain immutable instants. */
import type { NotificationId, UserId } from '../shared/EntityIds';
import type { Instant } from '../shared/Instant';
import type { Result } from '../shared/Result';
import type { Notification } from './Notification';

export type NotificationMutationFailure = 'common.errors.unexpected';
export interface NotificationRecipientRepository {
  findById(
    id: NotificationId
  ): Promise<Result<Notification | null, NotificationMutationFailure>>;
  findByIds(
    ids: readonly NotificationId[]
  ): Promise<Result<Notification[], NotificationMutationFailure>>;
  markAsRead(
    id: NotificationId,
    recipientId: UserId,
    at: Instant
  ): Promise<Result<void, NotificationMutationFailure>>;
  markAllAsRead(
    recipientId: UserId,
    at: Instant
  ): Promise<Result<void, NotificationMutationFailure>>;
  deleteByIds(
    ids: readonly NotificationId[],
    recipientId: UserId
  ): Promise<Result<void, NotificationMutationFailure>>;
}
