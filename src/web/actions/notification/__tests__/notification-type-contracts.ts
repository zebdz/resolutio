/** Notification clients retain event/payload correlation, identities and count units.
 * These negative contracts compile only when action transport types preserve the domain. */
import type {
  getNotificationsAction,
  getUnreadNotificationCountAction,
} from '../notification';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import {
  PollId,
  OrganizationId,
  UserId,
  NotificationId,
} from '@/domain/shared/EntityIds';
import {
  getNotificationActionUrl,
  type NotificationActionKey,
} from '@/web/utils/notificationActionUrl';
import type { NotificationsListProps } from '@/app/[locale]/notifications/NotificationsList';

type Page = Extract<
  Awaited<ReturnType<typeof getNotificationsAction>>,
  { success: true }
>['data'];
type Item = Page['notifications'][number];
type Unread = Extract<
  Awaited<ReturnType<typeof getUnreadNotificationCountAction>>,
  { success: true }
>['data'];
declare const item: Item;
// @ts-expect-error Notification identities must be decoded before assignment.
const uncheckedId: Item['id'] = 'notification-1';
// @ts-expect-error Event kinds form a closed set.
const unknownKind: Item['type'] = 'unknown';
// @ts-expect-error Totals preserve their validated count unit.
const uncheckedTotal: Page['totalCount'] = 2;
// @ts-expect-error Unread counts preserve their validated count unit.
const uncheckedUnread: Unread['count'] = 2;

if (item.type === 'poll_finished') {
  const pollId: PollId = item.data.pollId;
  // @ts-expect-error A poll event cannot contain an organization-only payload.
  const organizationId: OrganizationId = item.data.organizationId;
}

const validCount: Page['unreadCount'] = NotificationCount.parse(2);
// @ts-expect-error Client props cannot widen authoritative count units.
const uncheckedClientCount: NotificationsListProps['initialTotalCount'] = 2;
// @ts-expect-error Navigation must use one correlated event, not independent arguments.
getNotificationActionUrl('poll_finished', { pollId: PollId.parse('poll-1') });
getNotificationActionUrl({
  type: 'poll_finished',
  // @ts-expect-error An organization identity cannot identify the linked poll.
  data: { pollId: OrganizationId.parse('org-1'), pollTitle: 'Poll' },
});
// @ts-expect-error Action localization keys form a closed set.
const unknownAction: NotificationActionKey = 'unknown';

import type { NotificationReader } from '@/domain/notification/NotificationReader';
import {
  Notification,
  type NotificationProps,
} from '@/domain/notification/Notification';
declare const reader: NotificationReader;
declare const storedNotification: NotificationProps;
const restoredNotification = Notification.restore(storedNotification);
// @ts-expect-error Restoration failures must be handled before accessing the aggregate.
const uncheckedRestoredId = restoredNotification.value.id;
// @ts-expect-error Inbox readers require a decoded recipient identity.
reader.findByUserId('user-1');

async function handleReadResults() {
  const list = await reader.findByUserId(UserId.parse('user-1'));
  // @ts-expect-error The failure alternative must be checked before reading notifications.
  list.value.map((notification: Notification) => notification.toJSON());
  const count = await reader.getUnreadCount(UserId.parse('user-1'));
  // @ts-expect-error A read result cannot masquerade as a validated count.
  const uncheckedCount: NotificationCount = count;
}

import type { NotificationRecipientRepository } from '@/domain/notification/NotificationRecipientRepository';
import { Instant } from '@/domain/shared/Instant';
declare const recipients: NotificationRecipientRepository;
declare const notificationId: NotificationId;
const recipientId = UserId.parse('user-1');
const readInstant = Instant.parse('2026-11-04T12:00:00.000Z');
// @ts-expect-error User identities cannot identify a notification to mark read.
recipients.markAsRead(recipientId, recipientId, readInstant);
// @ts-expect-error The recipient identity is required in addition to the timestamp.
recipients.markAsRead(notificationId, readInstant);
// @ts-expect-error Mutable Dates cannot cross the mutation port in place of an Instant.
recipients.markAsRead(notificationId, recipientId, new Date());
// @ts-expect-error A deletion selection contains notification identities, not user identities.
recipients.deleteByIds([recipientId], recipientId);

async function handleMutationResults() {
  const result = await recipients.markAsRead(
    notificationId,
    recipientId,
    readInstant
  );
  // @ts-expect-error A mutation result cannot be used as success without handling its failure alternative.
  const applied: { success: true; value: void } = result;
}
