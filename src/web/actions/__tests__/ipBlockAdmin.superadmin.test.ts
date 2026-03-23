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

vi.mock('@/infrastructure/repositories/IpBlockRepository', () => ({
  IpBlockRepository: class {},
}));

vi.mock('@/infrastructure/rateLimit/ipBlockCheck', () => ({
  invalidateIpBlockCache: vi.fn(),
}));

const {
  blockIpAction,
  unblockIpAction,
  getIpBlockStatusAction,
  getIpBlockHistoryAction,
  searchBlockedIpsAction,
  getBlockedIpsAction,
} = await import('../superadmin/ipBlockAdmin');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('ipBlockAdmin actions - superadmin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);
  });

  it.each([
    [
      'blockIpAction',
      () => blockIpAction({ ipAddress: '1.2.3.4', reason: 'test' }),
    ],
    [
      'unblockIpAction',
      () => unblockIpAction({ ipAddress: '1.2.3.4', reason: 'test' }),
    ],
    [
      'getIpBlockStatusAction',
      () => getIpBlockStatusAction({ ipAddress: '1.2.3.4' }),
    ],
    [
      'getIpBlockHistoryAction',
      () => getIpBlockHistoryAction({ ipAddress: '1.2.3.4' }),
    ],
    ['searchBlockedIpsAction', () => searchBlockedIpsAction({ query: 'test' })],
    [
      'getBlockedIpsAction',
      () => getBlockedIpsAction({ page: 1, pageSize: 10 }),
    ],
  ])('%s rejects non-superadmin', async (_name, callAction) => {
    const result = await callAction();

    expect(result).toEqual(AUTH_ERROR);
    expect(mockRequireSuperadmin).toHaveBeenCalled();
  });
});
