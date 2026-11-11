/** Authenticated layout keeps unavailable moderation/count reads explicit and localized.
 * Active blocks retain redirect priority; only valid reads render the shell and protected children. */
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { failure, success } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
import { UserId } from '@/domain/shared/EntityIds';
import { NotificationCount } from '@/domain/notification/NotificationContent';
const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  redirect: vi.fn(),
  unread: vi.fn(),
}));
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: async () => ({
    id: UserId.parse('user'),
    isConfirmed: () => true,
    privacySetupCompleted: true,
    firstName: 'Alice',
  }),
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    async isSuperAdmin() {
      return false;
    }
    async isUserBlocked() {
      return false;
    }
  },
  PrismaNotificationRepository: class {
    async getUnreadCount() {
      return 0;
    }
  },
}));
vi.mock('@/infrastructure/repositories/PrismaUserModerationRepository', () => ({
  PrismaUserModerationRepository: class {
    getStatus = mocks.getStatus;
  },
}));
vi.mock('@/infrastructure/repositories/PrismaNotificationReader', () => ({
  PrismaNotificationReader: class {
    getUnreadCount = mocks.unread;
  },
}));
vi.mock('@/web/lib/redirectLocalized', () => ({
  redirectLocalized: (...args: unknown[]) => {
    mocks.redirect(...args);
    throw new Error('redirected');
  },
}));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async () => 'Localized read error',
}));
vi.mock('@/src/web/components/catalyst/stacked-layout', () => ({
  StackedLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('../AppNavbar', () => ({ AppNavbar: () => null }));
vi.mock('../MobileSidebar', () => ({ MobileSidebar: () => null }));
const { AuthenticatedLayout } = await import('../AuthenticatedLayout');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStatus.mockResolvedValue(success(null));
  mocks.unread.mockResolvedValue(success(NotificationCount.parse(0)));
});
it('shows a localized unavailable-count error without fabricating a zero badge', async () => {
  mocks.unread.mockResolvedValue(failure('common.errors.unexpected'));
  const html = renderToStaticMarkup(
    await AuthenticatedLayout({ children: 'protected-content' })
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('Localized read error');
  expect(html).not.toContain('protected-content');
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it('renders protected content when no block exists', async () => {
  const element = await AuthenticatedLayout({ children: 'protected-content' });
  expect(renderToStaticMarkup(element)).toContain('protected-content');
});
it('renders an explicit localized error instead of protected children when a status read fails', async () => {
  mocks.getStatus.mockResolvedValue(failure('common.errors.unexpected'));
  const element = await AuthenticatedLayout({ children: 'protected-content' });
  const html = renderToStaticMarkup(element);
  expect(html).toContain('Localized read error');
  expect(html).not.toContain('protected-content');
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it('redirects an active block to the existing blocked page', async () => {
  mocks.getStatus.mockResolvedValue(
    success({
      blocked: true,
      blockedAt: Instant.parse('2026-11-04T12:00:00.000Z'),
    })
  );
  await expect(
    AuthenticatedLayout({ children: 'protected-content' })
  ).rejects.toThrow('redirected');
  expect(mocks.redirect).toHaveBeenCalledWith('en', '/blocked');
});
it('keeps the blocked redirect when the unread count is unavailable', async () => {
  mocks.unread.mockResolvedValue(failure('common.errors.unexpected'));
  mocks.getStatus.mockResolvedValue(
    success({
      blocked: true,
      blockedAt: Instant.parse('2026-11-04T12:00:00.000Z'),
    })
  );
  await expect(
    AuthenticatedLayout({ children: 'protected-content' })
  ).rejects.toThrow('redirected');
  expect(mocks.redirect).toHaveBeenCalledWith('en', '/blocked');
});
