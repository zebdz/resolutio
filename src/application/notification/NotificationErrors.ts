/** Notification application failures include explicit unavailable reads and recipient mutations.
 * Inbound adapters localize these stable codes alongside validation/ownership errors. */
import type { NotificationReadFailure } from '@/domain/notification/NotificationReader';
import type { NotificationMutationFailure } from '@/domain/notification/NotificationRecipientRepository';
import type { NotificationStorageFailure } from '@/domain/notification/NotificationRepository';
import type { NotificationDomainCode } from '@/domain/notification/NotificationDomainCodes';

export type NotificationDeliveryFailure =
  | NotificationDomainCode
  | NotificationStorageFailure;

export const NotificationErrors = {
  NOT_FOUND: 'notification.errors.notFound',
  NOT_OWNER: 'notification.errors.notOwner',
  EMPTY_IDS: 'notification.errors.emptyIds',
  SOME_NOT_FOUND: 'notification.errors.someNotFound',
} as const;

export type NotificationFailure =
  | NotificationReadFailure
  | NotificationMutationFailure
  | (typeof NotificationErrors)[keyof typeof NotificationErrors]
  | 'common.errors.validationFailed';
