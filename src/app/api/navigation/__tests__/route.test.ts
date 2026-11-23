/** The optional site header exposes only the current viewer's navigation fields. */
import { beforeEach, expect, it, vi } from 'vitest';
import { success } from '@/domain/shared/Result';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  superAdmin: vi.fn(),
  unread: vi.fn(),
  moderation: vi.fn(),
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.session }));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    isSuperAdmin = mocks.superAdmin;
  },
}));
vi.mock('@/infrastructure/repositories/PrismaNotificationReader', () => ({
  PrismaNotificationReader: class {
    getUnreadCount = mocks.unread;
  },
}));
vi.mock('@/infrastructure/repositories/PrismaUserModerationRepository', () => ({
  PrismaUserModerationRepository: class {
    getStatus = mocks.moderation;
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

it('returns only the signed-in viewer’s own header fields as a private response', async () => {
  mocks.session.mockResolvedValue({
    id: 'user1',
    firstName: 'Alice',
    email: 'alice@example.invalid',
    isConfirmed: () => true,
    privacySetupCompleted: true,
  });
  mocks.superAdmin.mockResolvedValue(true);
  mocks.moderation.mockResolvedValue(success(null));
  mocks.unread.mockResolvedValue(success(3));
  const response = await GET();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    firstName: 'Alice',
    isSuperAdmin: true,
    unreadNotificationCount: 3,
  });
});

it('returns no account data for a guest without redirecting', async () => {
  mocks.session.mockResolvedValue(null);
  const response = await GET();
  expect(response.status).toBe(204);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toBe('');
  expect(mocks.unread).not.toHaveBeenCalled();
});
