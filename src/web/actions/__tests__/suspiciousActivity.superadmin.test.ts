import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireSuperadmin = vi.fn();

vi.mock('@/web/actions/superadminAuth', () => ({
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

vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: { getInstance: vi.fn().mockReturnValue({}) },
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: vi.fn().mockResolvedValue('error'),
}));

const {
  getSuspiciousActivitySummaryAction,
  getSuspiciousActivityForKeyAction,
  blockUserAction,
  unblockUserAction,
  getUserBlockStatusAction,
  getUserBlockHistoryAction,
  searchUsersForAdminAction,
  listUsersForAdminAction,
  searchOrganizationsForFilterAction,
  getUserPollsForAdminAction,
  getOrganizationNameAction,
} = await import('../suspiciousActivity');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('suspiciousActivity actions - superadmin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);
  });

  it.each([
    [
      'getSuspiciousActivitySummaryAction',
      () => getSuspiciousActivitySummaryAction({}),
    ],
    [
      'getSuspiciousActivityForKeyAction',
      () => getSuspiciousActivityForKeyAction({ key: 'x' }),
    ],
    [
      'blockUserAction',
      () => blockUserAction({ userId: 'u1', reason: 'test' }),
    ],
    [
      'unblockUserAction',
      () => unblockUserAction({ userId: 'u1', reason: 'test' }),
    ],
    [
      'getUserBlockStatusAction',
      () => getUserBlockStatusAction({ userId: 'u1' }),
    ],
    [
      'getUserBlockHistoryAction',
      () => getUserBlockHistoryAction({ userId: 'u1' }),
    ],
    [
      'searchUsersForAdminAction',
      () => searchUsersForAdminAction({ query: 'test' }),
    ],
    [
      'listUsersForAdminAction',
      () => listUsersForAdminAction({ page: 1, pageSize: 10 }),
    ],
    [
      'searchOrganizationsForFilterAction',
      () => searchOrganizationsForFilterAction({ query: 'test' }),
    ],
    [
      'getUserPollsForAdminAction',
      () => getUserPollsForAdminAction({ userId: 'u1' }),
    ],
    [
      'getOrganizationNameAction',
      () => getOrganizationNameAction({ organizationId: 'o1' }),
    ],
  ])('%s rejects non-superadmin', async (_name, callAction) => {
    const result = await callAction();

    expect(result).toEqual(AUTH_ERROR);
    expect(mockRequireSuperadmin).toHaveBeenCalled();
  });
});
