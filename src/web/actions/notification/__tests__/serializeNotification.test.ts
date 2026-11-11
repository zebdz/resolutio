/** Notification transport selects recipient-visible fields and detaches nested payloads/dates.
 * Audit/recipient fields added to server projections must never cross this boundary. */
import { expect, it } from 'vitest';
import { NotificationId, UserId } from '@/domain/shared/EntityIds';
import { NotificationContent } from '@/domain/notification/NotificationContent';
import { serializeNotification } from '../serializeNotification';
import { notificationSamples } from './notificationTestViews';

it.each(['join_request_rejected', 'join_parent_request_rejected'])(
  'preserves %s historical reason bytes and body choice',
  (kind) => {
    const sample = notificationSamples.find((source) => source.type === kind);
    const content = NotificationContent.parse({
      ...sample,
      body:
        kind === 'join_request_rejected'
          ? 'notification.types.joinRequestRejected.bodyWithReason'
          : 'notification.types.joinParentRequestRejected.bodyWithReason',
      data: { ...sample?.data, rejectionReason: ' Legacy reason\n ' },
    });
    const source = {
      ...content,
      id: NotificationId.parse('notification-1'),
      userId: UserId.parse('user-1'),
      readAt: null,
      createdAt: new Date('2026-11-04T12:00:00.000Z'),
    };
    expect(serializeNotification(source)).toEqual({
      id: source.id,
      type: content.type,
      title: content.title,
      body: content.body,
      data: content.data,
      readAt: null,
      createdAt: source.createdAt,
    });
  }
);

it.each(notificationSamples)(
  '$type preserves exact fields and excludes extra audit data',
  (source) => {
    const input = Object.assign({}, source, {
      privateAudit: 'secret',
      data: Object.assign({}, source.data, { privateAudit: 'nested-secret' }),
      readAt: new Date('2026-11-04T13:00:00.000Z'),
    });
    const view = serializeNotification(input);
    expect(view).toEqual({
      id: source.id,
      type: source.type,
      title: source.title,
      body: source.body,
      data: source.data,
      readAt: input.readAt,
      createdAt: source.createdAt,
    });
    expect(view.data).not.toBe(input.data);
    expect(view.readAt).not.toBe(input.readAt);
    expect(view.createdAt).not.toBe(input.createdAt);
    view.createdAt.setUTCFullYear(2000);
    expect(source.createdAt.getUTCFullYear()).toBe(2026);
  }
);

it('serializes a plain poll event without private source fields', () => {
  const content = NotificationContent.parse({
    type: 'poll_finished',
    title: 'notification.types.pollFinished.title',
    body: 'notification.types.pollFinished.body',
    data: { pollId: 'poll-1', pollTitle: ' Poll ' },
  });

  if (content.type !== 'poll_finished') {
    return expect.unreachable();
  }

  const createdAt = new Date('2026-11-04T12:00:00.000Z');
  const source = {
    ...content,
    data: { ...content.data, privateAudit: 'secret' },
    id: NotificationId.parse('notification-1'),
    userId: UserId.parse('user-1'),
    readAt: null,
    createdAt,
    privateAudit: 'secret',
  };
  const view = serializeNotification(source);
  expect(view).toEqual({
    id: 'notification-1',
    type: 'poll_finished',
    title: content.title,
    body: content.body,
    data: { pollId: 'poll-1', pollTitle: ' Poll ' },
    readAt: null,
    createdAt,
  });
  expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
  expect(Object.getPrototypeOf(view.data)).toBe(Object.prototype);
  expect(view.data).not.toBe(source.data);
  expect(view.createdAt).not.toBe(createdAt);
});
