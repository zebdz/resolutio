import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireSuperadmin = vi.fn();

vi.mock('@/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: mockRequireSuperadmin,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/infrastructure/rateLimit/registry', () => ({
  limiterRegistry: [],
}));

const { getRateLimitMonitorSnapshotAction, getKeyLimiterDetailsAction } =
  await import('../superadmin/rateLimitMonitor');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('rateLimitMonitor actions - superadmin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);
  });

  it.each([
    [
      'getRateLimitMonitorSnapshotAction',
      () => getRateLimitMonitorSnapshotAction(),
    ],
    [
      'getKeyLimiterDetailsAction',
      () => getKeyLimiterDetailsAction({ key: 'k1' }),
    ],
  ])('%s rejects non-superadmin', async (_name, callAction) => {
    const result = await callAction();

    expect(result).toEqual(AUTH_ERROR);
    expect(mockRequireSuperadmin).toHaveBeenCalled();
  });
});
