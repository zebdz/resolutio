/** Notifications receive identity/time explicitly and retain validated content.
 * Raw persisted data must not create malformed recipients or payload alternatives. */
import { expect, it } from 'vitest';
import { Notification } from '../Notification';
import { NotificationId, UserId, PollId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';
import { Instant } from '../../shared/Instant';

it('does not disguise unexpected caller bugs as a notification validation failure', () => {
  const bug = new Error('unexpected recipient getter failure');
  const input = {
    get userId(): UserId {
      throw bug;
    },
    type: 'poll_finished' as const,
    title: 'notification.types.pollFinished.title' as const,
    body: 'notification.types.pollFinished.body' as const,
    data: { pollId: PollId.parse('poll-1'), pollTitle: 'Poll' },
  };
  expect(() =>
    Notification.create(input, testCreation(NotificationId, 'n-1'))
  ).toThrow(bug);
});

it('restores stored identities/content/time through an explicit result', () => {
  const raw = {
    id: 'n-1',
    userId: 'u-1',
    type: 'poll_finished',
    title: 'notification.types.pollFinished.title',
    body: 'notification.types.pollFinished.body',
    data: { pollId: 'poll-1', pollTitle: ' Poll ' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    readAt: null,
  };
  const restored = Notification.restore(raw);
  expect(restored.success).toBe(true);

  if (!restored.success) {
    return expect.unreachable();
  }

  expect(restored.value.toJSON()).toEqual(raw);
  expect(Notification.restore({ ...raw, id: '' })).toEqual({
    success: false,
    error: 'domain.notification.invalidData',
  });
  expect(Notification.restore({ ...raw, createdAt: new Date(NaN) })).toEqual({
    success: false,
    error: 'domain.notification.invalidData',
  });
});
it('restores detached immutable state and retains the first read instant', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const readAt = new Date('2026-01-02T00:00:00.000Z');
  const data = { pollId: 'poll-1', pollTitle: ' Poll ' };
  const restored = Notification.restore({
    id: 'n-1',
    userId: 'u-1',
    type: 'poll_finished',
    title: 'notification.types.pollFinished.title',
    body: 'notification.types.pollFinished.body',
    data,
    createdAt,
    readAt,
  });

  if (!restored.success) {
    return expect.unreachable();
  }

  createdAt.setUTCFullYear(2000);
  readAt.setUTCFullYear(2000);
  data.pollTitle = 'changed';
  restored.value.markAsRead(Instant.parse('2026-01-03T00:00:00.000Z'));
  expect(restored.value.createdAt.toISOString()).toBe(
    '2026-01-01T00:00:00.000Z'
  );
  expect(restored.value.readAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  expect(restored.value.data).toEqual({
    pollId: 'poll-1',
    pollTitle: ' Poll ',
  });
  expect(Object.isFrozen(restored.value.data)).toBe(true);
});

it('creates with caller identity and time', () => {
  const creation = testCreation(NotificationId, 'assigned-notification');
  const result = Notification.create(
    {
      userId: UserId.parse('user-1'),
      type: 'poll_finished',
      title: 'notification.types.pollFinished.title',
      body: 'notification.types.pollFinished.body',
      data: { pollId: PollId.parse('poll-1'), pollTitle: 'Poll' },
    },
    creation
  );
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.id).toBe(creation.id);
  expect(result.value.createdAt.toISOString()).toBe(creation.now);
});

it('rejects unknown notification kinds and missing poll payload identifiers on loading', () => {
  const raw = {
    id: 'n-1',
    userId: 'u-1',
    type: 'poll_finished',
    title: 'notification.types.pollFinished.title',
    body: 'notification.types.pollFinished.body',
    data: { pollTitle: 'Poll' },
    createdAt: new Date('2026-01-01'),
    readAt: null,
  };
  expect(Notification.restore(raw)).toEqual({
    success: false,
    error: 'domain.notification.invalidData',
  });
  expect(Notification.restore({ ...raw, type: 'unknown', data: {} })).toEqual({
    success: false,
    error: 'domain.notification.invalidData',
  });
});
