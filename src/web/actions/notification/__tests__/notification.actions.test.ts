/** Real notification use cases preserve recipient ownership and explicit read/mutation failures.
 * Rate/auth gates precede persistence; transport data and localized errors retain their contracts. */
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { beforeEach, expect, it, vi } from 'vitest';
import { Notification } from '@/domain/notification/Notification';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import { UserId } from '@/domain/shared/EntityIds';
import { success, failure } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
import { notificationSamples } from './notificationTestViews';

const mocks = vi.hoisted(() => ({
  rate: vi.fn(),
  user: vi.fn(),
  find: vi.fn(),
  unread: vi.fn(),
  count: vi.fn(),
  findOne: vi.fn(),
  findSelected: vi.fn(),
  mark: vi.fn(),
  markAll: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.rate }));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
}));
vi.mock('@/infrastructure/repositories/PrismaNotificationReader', () => ({
  PrismaNotificationReader: class {
    findByUserId = mocks.find;
    getUnreadCount = mocks.unread;
    getCountByUserId = mocks.count;
  },
}));
vi.mock(
  '@/infrastructure/repositories/PrismaNotificationRecipientRepository',
  () => ({
    PrismaNotificationRecipientRepository: class {
      findById = mocks.findOne;
      findByIds = mocks.findSelected;
      markAsRead = mocks.mark;
      markAllAsRead = mocks.markAll;
      deleteByIds = mocks.remove;
    },
  })
);
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `localized:${key}`,
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const {
  getNotificationsAction,
  getUnreadNotificationCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  deleteNotificationsAction,
} = await import('../notification');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rate.mockResolvedValue(null);
  mocks.user.mockResolvedValue({ id: UserId.parse('user-1') });
  mocks.find.mockResolvedValue(
    success(
      notificationSamples.map((sample) =>
        expectSuccess(Notification.restore(sample))
      )
    )
  );
  mocks.unread.mockResolvedValue(success(NotificationCount.parse(32)));
  mocks.count.mockResolvedValue(success(NotificationCount.parse(40)));
  const notification = expectSuccess(
    Notification.restore({
      ...notificationSamples[0],
      id: 'notification-1',
    })
  );
  mocks.findOne.mockResolvedValue(success(notification));
  mocks.findSelected.mockResolvedValue(success([notification]));
  mocks.mark.mockResolvedValue(success(undefined));
  mocks.markAll.mockResolvedValue(success(undefined));
  mocks.remove.mockResolvedValue(success(undefined));
});

const mutations = [
  {
    name: 'mark',
    action: () => markNotificationReadAction('notification-1'),
    write: mocks.mark,
  },
  {
    name: 'mark all',
    action: () => markAllNotificationsReadAction(),
    write: mocks.markAll,
  },
  {
    name: 'delete',
    action: () => deleteNotificationsAction(['notification-1']),
    write: mocks.remove,
  },
];
it.each(mutations)(
  '$name translates write failures',
  async ({ action, write }) => {
    write.mockResolvedValue(failure('common.errors.unexpected'));
    expect(await action()).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
  }
);
it.each(mutations)(
  '$name preserves successful recipient-scoped mutations',
  async ({ action, write, name }) => {
    expect(await action()).toEqual({ success: true, data: undefined });

    if (name === 'delete') {
      expect(write).toHaveBeenCalledWith(['notification-1'], 'user-1');
    } else {
      const args = write.mock.calls[0];
      expect(args.slice(0, -1)).toEqual(
        name === 'mark' ? ['notification-1', 'user-1'] : ['user-1']
      );
      expect(Instant.safeParse(args.at(-1)).success).toBe(true);
    }
  }
);
it.each(mutations)(
  '$name rate limits before user, lookup and write calls',
  async ({ action }) => {
    mocks.rate.mockResolvedValue({ success: false, error: 'rate limited' });
    expect(await action()).toEqual({ success: false, error: 'rate limited' });
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.findSelected).not.toHaveBeenCalled();
    expect(mocks.mark).not.toHaveBeenCalled();
    expect(mocks.markAll).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  }
);
it.each(mutations)(
  '$name authenticates before lookup and write calls',
  async ({ action }) => {
    mocks.user.mockResolvedValue(null);
    expect(await action()).toEqual({
      success: false,
      error: 'localized:unauthorized',
    });
    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.findSelected).not.toHaveBeenCalled();
    expect(mocks.mark).not.toHaveBeenCalled();
    expect(mocks.markAll).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  }
);
it.each(['mark', 'delete'] as const)(
  '%s stops before writes when loading fails',
  async (operation) => {
    mocks.findOne.mockResolvedValue(failure('common.errors.unexpected'));
    mocks.findSelected.mockResolvedValue(failure('common.errors.unexpected'));
    const result =
      operation === 'mark'
        ? await markNotificationReadAction('notification-1')
        : await deleteNotificationsAction(['notification-1']);
    expect(result).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
    expect(mocks.mark).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  }
);
it.each(['mark', 'delete'] as const)(
  '%s rejects a foreign recipient before writes',
  async (operation) => {
    const foreign = expectSuccess(
      Notification.restore({
        ...notificationSamples[0],
        id: 'notification-1',
        userId: 'user-2',
      })
    );
    mocks.findOne.mockResolvedValue(success(foreign));
    mocks.findSelected.mockResolvedValue(success([foreign]));
    const result =
      operation === 'mark'
        ? await markNotificationReadAction('notification-1')
        : await deleteNotificationsAction(['notification-1']);
    expect(result).toEqual({
      success: false,
      error: 'translated:notification.errors.notOwner',
    });
    expect(mocks.mark).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  }
);

it.each(['find', 'unread', 'count'] as const)(
  'translates %s read failures instead of returning a successful inbox',
  async (method) => {
    mocks[method].mockResolvedValue(failure('common.errors.unexpected'));
    expect(await getNotificationsAction()).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
  }
);
it('translates an unavailable unread count', async () => {
  mocks.unread.mockResolvedValue(failure('common.errors.unexpected'));
  expect(await getUnreadNotificationCountAction()).toEqual({
    success: false,
    error: 'translated:common.errors.unexpected',
  });
});

it('returns only the authenticated recipient’s plain event fields and authoritative counts', async () => {
  const result = await getNotificationsAction(20, 2);
  expect(mocks.find).toHaveBeenCalledWith('user-1', { limit: 20, offset: 2 });
  expect(mocks.unread).toHaveBeenCalledWith('user-1');
  expect(mocks.count).toHaveBeenCalledWith('user-1');
  expect(result.success).toBe(true);

  if (!result.success) {
    return expect.unreachable();
  }

  expect(result.data).toEqual({
    notifications: notificationSamples.map(({ userId, ...view }) => view),
    unreadCount: 32,
    totalCount: 40,
  });

  for (const view of result.data.notifications) {
    expect(view).not.toHaveProperty('userId');
    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(view.data)).toBe(Object.prototype);
  }
});
it('keeps the unread-count response and recipient scope', async () => {
  expect(await getUnreadNotificationCountAction()).toEqual({
    success: true,
    data: { count: 32 },
  });
  expect(mocks.unread).toHaveBeenCalledWith('user-1');
});
it.each([getNotificationsAction, getUnreadNotificationCountAction])(
  'enforces rate limits before identity/storage reads',
  async (action) => {
    mocks.rate.mockResolvedValue({ success: false, error: 'rate limited' });
    expect(await action()).toEqual({ success: false, error: 'rate limited' });
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.unread).not.toHaveBeenCalled();
  }
);
it.each([getNotificationsAction, getUnreadNotificationCountAction])(
  'requires authentication before storage reads',
  async (action) => {
    mocks.user.mockResolvedValue(null);
    expect(await action()).toEqual({
      success: false,
      error: 'localized:unauthorized',
    });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.unread).not.toHaveBeenCalled();
  }
);
it('translates invalid paging without invoking persistence', async () => {
  expect(await getNotificationsAction(-1, 0)).toEqual({
    success: false,
    error: 'translated:common.errors.validationFailed',
  });
  expect(mocks.find).not.toHaveBeenCalled();
  expect(mocks.unread).not.toHaveBeenCalled();
  expect(mocks.count).not.toHaveBeenCalled();
});
