/** Direct moderation actions propagate persistence failures and enforce typed input boundaries.
 * Historical nullable reasons and plain status/history payloads retain their existing wire form. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { success, failure } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
const mocks = vi.hoisted(() => ({
  append: vi.fn(),
  getStatus: vi.fn(),
  getHistory: vi.fn(),
  auth: vi.fn(),
  legacyCreate: vi.fn(),
  superadmin: vi.fn(),
}));
vi.mock('@/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: mocks.auth,
}));
vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: async () => null,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {
    userBlockStatus: {
      create: mocks.legacyCreate,
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  PrismaUserRepository: class {
    isSuperAdmin = mocks.superadmin;
  },
}));
vi.mock('@/infrastructure/repositories/PrismaUserModerationRepository', () => ({
  PrismaUserModerationRepository: class {
    append = mocks.append;
    getStatus = mocks.getStatus;
    getHistory = mocks.getHistory;
  },
}));
vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: {
    getInstance: () => ({
      containsProfanity: (text: string) => text.includes('badword'),
      findProfaneWords: () => [],
    }),
  },
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) =>
    code === 'superadmin.users.reasonRequired'
      ? 'reasonRequired'
      : `translated:${code}`,
}));
const {
  blockUserAction,
  unblockUserAction,
  getUserBlockStatusAction,
  getUserBlockHistoryAction,
} = await import('../superadmin/suspiciousActivity');
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: 'admin' });
  mocks.superadmin.mockResolvedValue(true);
  mocks.append.mockResolvedValue(success(undefined));
  mocks.getStatus.mockResolvedValue(success(null));
  mocks.getHistory.mockResolvedValue(success([]));
});
afterEach(() => {
  vi.restoreAllMocks();
});
it.each([blockUserAction, unblockUserAction])(
  'reports failed persistence instead of success',
  async (action) => {
    mocks.append.mockResolvedValue(failure('common.errors.unexpected'));
    expect(await action({ userId: 'target', reason: ' Spam ' })).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
    expect(mocks.legacyCreate).not.toHaveBeenCalled();
  }
);
it.each([blockUserAction, unblockUserAction])(
  'rejects invalid target identity before persistence',
  async (action) => {
    expect(await action({ userId: '', reason: 'Spam' })).toEqual({
      success: false,
      error: 'translated:common.errors.validationFailed',
    });
    expect(mocks.append).not.toHaveBeenCalled();
    expect(mocks.legacyCreate).not.toHaveBeenCalled();
  }
);
it.each([blockUserAction, unblockUserAction])(
  'preserves reason validation and profanity field errors',
  async (action) => {
    expect(await action({ userId: 'target', reason: '  ' })).toEqual({
      success: false,
      error: 'reasonRequired',
    });
    const message = 'translated:domain.shared.containsProfanity';
    expect(await action({ userId: 'target', reason: 'badword' })).toEqual({
      success: false,
      error: message,
      fieldErrors: { reason: [message] },
    });
    expect(mocks.append).not.toHaveBeenCalled();
  }
);
it.each([getUserBlockStatusAction, getUserBlockHistoryAction])(
  'propagates failed moderation reads',
  async (action) => {
    mocks.getStatus.mockResolvedValue(failure('common.errors.unexpected'));
    mocks.getHistory.mockResolvedValue(failure('common.errors.unexpected'));
    expect(await action({ userId: 'target' })).toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
  }
);
it('converts a blocked timestamp to its existing Date payload', async () => {
  const at = Instant.parse('2026-11-04T12:00:00.000Z');
  mocks.getStatus.mockResolvedValue(
    success({ blocked: true, reason: '', blockedAt: at })
  );
  expect(await getUserBlockStatusAction({ userId: 'target' })).toEqual({
    success: true,
    data: { blocked: true, reason: '', blockedAt: new Date(at) },
  });
});
