/** Admin enrichment and filtering propagate unavailable moderation data.
 * Bulk queries retain Date/ISO payloads and do not fall back to unvalidated ORM statuses. */
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { failure, success } from '@/domain/shared/Result';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
const mocks = vi.hoisted(() => ({
  statuses: vi.fn(),
  blocked: vi.fn(),
  users: vi.fn(),
  legacyRead: vi.fn(),
}));
const at = new Date('2026-11-04T12:00:00.000Z');
vi.mock('@/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: async () => ({ userId: 'admin' }),
}));
vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: async () => null,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
vi.mock('@/infrastructure/rateLimit/registry', () => ({
  getLimiterByLabel: () => undefined,
}));
vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: { getInstance: () => ({}) },
}));
vi.mock('@/infrastructure/repositories/PrismaUserModerationRepository', () => ({
  PrismaUserModerationRepository: class {
    getStatuses = mocks.statuses;
    getBlockedUserIds = mocks.blocked;
  },
}));
vi.mock('@/infrastructure/index', () => ({
  PrismaUserRepository: class {},
  prisma: {
    rateLimitEvent: {
      groupBy: async () => [
        {
          key: 'key',
          limiterLabel: 'label',
          userId: 'u1',
          _count: { id: 1 },
          _min: { createdAt: new Date('2026-11-04') },
          _max: { createdAt: new Date('2026-11-04') },
        },
      ],
      count: async () => 1,
    },
    user: { findMany: mocks.users, count: async () => 1 },
    userBlockStatus: {
      findMany: mocks.legacyRead,
      findFirst: mocks.legacyRead,
    },
    organizationUser: { findMany: async () => [] },
    pollParticipant: { groupBy: async () => [] },
  },
}));
const {
  getSuspiciousActivitySummaryAction,
  searchUsersForAdminAction,
  listUsersForAdminAction,
} = await import('../superadmin/suspiciousActivity');
vi.mock('@/src/i18n/routing', () => ({ Link: () => null }));
vi.mock(
  '@/src/app/[locale]/superadmin/suspicious-activity/SuspiciousActivityPanel',
  () => ({ SuspiciousActivityPanel: () => null })
);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.users.mockResolvedValue([
    {
      id: 'u1',
      firstName: 'Alice',
      lastName: 'Smith',
      middleName: null,
      phoneNumber: '+79001234567',
      nickname: 'alice1',
      createdAt: at,
      allowFindByName: true,
      allowFindByPhone: true,
    },
  ]);
  mocks.statuses.mockResolvedValue(success(new Map()));
  mocks.blocked.mockResolvedValue(success([]));
});
it.each([
  () => getSuspiciousActivitySummaryAction({}),
  () => searchUsersForAdminAction({ query: 'Alice' }),
  () => listUsersForAdminAction({ page: 1, pageSize: 10 }),
])(
  'propagates failed bulk enrichment without reporting a partial list',
  async (action) => {
    mocks.statuses.mockResolvedValue(failure('common.errors.unexpected'));
    expect(await action()).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
    expect(mocks.legacyRead).not.toHaveBeenCalled();
  }
);
it.each(['blocked', 'unblocked'] as const)(
  'propagates a failed %s filter query',
  async (blockStatus) => {
    mocks.blocked.mockResolvedValue(failure('common.errors.unexpected'));
    expect(
      await listUsersForAdminAction({ page: 1, pageSize: 10, blockStatus })
    ).toEqual({ success: false, error: 'translated:common.errors.unexpected' });
    expect(mocks.users).not.toHaveBeenCalled();
  }
);
it('preserves Date and ISO block timestamp representations', async () => {
  mocks.statuses.mockResolvedValue(
    success(
      new Map([
        [
          UserId.parse('u1'),
          { blocked: true, reason: '', blockedAt: Instant.fromDate(at) },
        ],
      ])
    )
  );
  const search = await searchUsersForAdminAction({ query: 'Alice' });
  const summary = await getSuspiciousActivitySummaryAction({});
  const list = await listUsersForAdminAction({ page: 1, pageSize: 10 });

  if (search.success) {
    expect(search.data[0].blockStatus).toEqual({
      blocked: true,
      reason: '',
      blockedAt: at,
    });
  } else {
    expect(search.success).toBe(true);
  }

  if (summary.success) {
    expect(summary.data.items[0].blockStatus).toEqual({
      blocked: true,
      reason: '',
      blockedAt: at,
    });
  } else {
    expect(summary.success).toBe(true);
  }

  if (list.success) {
    expect(list.data.users[0].blockStatus).toEqual({
      blocked: true,
      reason: '',
      blockedAt: at.toISOString(),
    });
  } else {
    expect(list.success).toBe(true);
  }

  expect(mocks.legacyRead).not.toHaveBeenCalled();
});
it('rejects invalid persisted user identities before moderation reads', async () => {
  mocks.users.mockResolvedValue([{ id: 'bad id' }]);
  expect(await searchUsersForAdminAction({ query: 'Alice' })).toEqual({
    success: false,
    error: 'translated:common.errors.unexpected',
  });
  expect(mocks.statuses).not.toHaveBeenCalled();
});
it('shows a failed summary read on the page instead of displaying an empty list', async () => {
  mocks.statuses.mockResolvedValue(failure('common.errors.unexpected'));
  const { default: Page } =
    await import('@/src/app/[locale]/superadmin/suspicious-activity/page');
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({}) })
  );
  expect(html).toContain('translated:common.errors.unexpected');
});

it('uses an empty identity set for an empty blocked filter, without inventing a user identity', async () => {
  mocks.blocked.mockResolvedValue(success([]));
  await listUsersForAdminAction({
    page: 1,
    pageSize: 10,
    blockStatus: 'blocked',
  });
  expect(mocks.users.mock.calls[0][0].where.AND).toContainEqual({
    id: { in: [] },
  });
});
