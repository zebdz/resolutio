import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockGetSessionCookie = vi.fn();
const mockIsSuperAdmin = vi.fn();
const mockGetClientIp = vi.fn().mockResolvedValue('1.2.3.4');
const mockRegisterSuperadminAccess = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
  getSessionCookie: mockGetSessionCookie,
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
}));

vi.mock('@/web/lib/clientIp', () => ({
  getClientIp: mockGetClientIp,
}));

vi.mock('@/infrastructure/rateLimit/superadminWhitelist', () => ({
  registerSuperadminAccess: mockRegisterSuperadminAccess,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

const { requireSuperadmin } = await import('../superadmin/superadminAuth');

describe('requireSuperadmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when no user session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await requireSuperadmin();

    expect(result).toEqual({ success: false, error: 'unauthorized' });
  });

  it('returns error when user is not superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(false);

    const result = await requireSuperadmin();

    expect(result).toEqual({ success: false, error: 'unauthorized' });
  });

  it('returns userId and registers access when superadmin', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockIsSuperAdmin.mockResolvedValue(true);
    mockGetSessionCookie.mockResolvedValue('session-123');

    const result = await requireSuperadmin();

    expect(result).toEqual({ userId: 'user-1' });
    expect(mockRegisterSuperadminAccess).toHaveBeenCalledWith(
      '1.2.3.4',
      'user-1',
      'session-123'
    );
  });
});
