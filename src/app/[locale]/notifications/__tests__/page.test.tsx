/** Notification page distinguishes failed reads from a valid empty inbox.
 * Successful responses reach the list with their typed identities and count units intact. */
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotificationCount } from '@/domain/notification/NotificationContent';
import { notificationSamples } from '@/web/actions/notification/__tests__/notificationTestViews';

const mocks = vi.hoisted(() => ({ read: vi.fn(), list: vi.fn() }));
vi.mock('@/src/web/actions/notification/notification', () => ({
  getNotificationsAction: mocks.read,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/src/web/components/layout/AuthenticatedLayout', () => ({
  AuthenticatedLayout: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../NotificationsList', () => ({ NotificationsList: mocks.list }));
const { default: Page } = await import('../page');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReturnValue(<div>inbox</div>);
});
it('displays a localized read failure instead of a successful empty inbox', async () => {
  mocks.read.mockResolvedValue({
    success: false,
    error: 'localized read failure',
  });
  const html = renderToStaticMarkup(await Page());
  expect(html).toContain('role="alert"');
  expect(html).toContain('localized read failure');
  expect(mocks.list).not.toHaveBeenCalled();
});
it('passes successful data and validated counts to the list', async () => {
  const data = {
    notifications: notificationSamples,
    unreadCount: NotificationCount.parse(32),
    totalCount: NotificationCount.parse(32),
  };
  mocks.read.mockResolvedValue({ success: true, data });
  expect(renderToStaticMarkup(await Page())).toContain('inbox');
  expect(mocks.list.mock.calls[0][0]).toEqual({
    initialNotifications: data.notifications,
    initialUnreadCount: data.unreadCount,
    initialTotalCount: data.totalCount,
  });
});
