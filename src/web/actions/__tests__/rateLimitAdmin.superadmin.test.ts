import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireSuperadmin = vi.fn();

vi.mock('@/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: mockRequireSuperadmin,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
}));

vi.mock('@/infrastructure/rateLimit/registry', () => ({
  limiterRegistry: [],
  getLimiterByLabel: vi.fn(),
}));

const {
  getRateLimitOverviewAction,
  resetAllRateLimitsAction,
  resetLimiterAction,
  clearBlockedKeysAction,
  searchRateLimitEntriesAction,
  resetRateLimitKeysAction,
  lockRateLimitKeyAction,
  unlockRateLimitKeyAction,
} = await import('../superadmin/rateLimitAdmin');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('rateLimitAdmin actions - superadmin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);
  });

  it.each([
    ['getRateLimitOverviewAction', () => getRateLimitOverviewAction()],
    ['resetAllRateLimitsAction', () => resetAllRateLimitsAction()],
    ['resetLimiterAction', () => resetLimiterAction({ label: 'test' })],
    ['clearBlockedKeysAction', () => clearBlockedKeysAction({ label: 'test' })],
    [
      'searchRateLimitEntriesAction',
      () => searchRateLimitEntriesAction({ label: 'test', query: 'test' }),
    ],
    [
      'resetRateLimitKeysAction',
      () => resetRateLimitKeysAction({ label: 'test', keys: ['k1'] }),
    ],
    [
      'lockRateLimitKeyAction',
      () => lockRateLimitKeyAction({ label: 'test', key: 'k1' }),
    ],
    [
      'unlockRateLimitKeyAction',
      () => unlockRateLimitKeyAction({ label: 'test', key: 'k1' }),
    ],
  ])('%s rejects non-superadmin', async (_name, callAction) => {
    const result = await callAction();

    expect(result).toEqual(AUTH_ERROR);
    expect(mockRequireSuperadmin).toHaveBeenCalled();
  });
});
