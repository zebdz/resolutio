import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireSuperadmin = vi.fn();
const mockExecute = vi.fn();

vi.mock('@/web/actions/superadmin/superadminAuth', () => ({
  requireSuperadmin: mockRequireSuperadmin,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: vi.fn(),
  PrismaOtpRepository: vi.fn(),
}));

vi.mock('@/application/auth/ResetUserOtpUseCase', () => ({
  ResetUserOtpUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: vi.fn(async (code: string) => `translated:${code}`),
}));

const { resetUserOtpAction } = await import('../superadmin/userOtp');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('resetUserOtpAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ success: true, value: { deleted: 2 } });
  });

  it('rejects non-superadmins without touching the codes', async () => {
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);

    const result = await resetUserOtpAction({ userId: 'user-1' });

    expect(result).toEqual(AUTH_ERROR);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('removes the codes for a superadmin and reports the count', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });

    const result = await resetUserOtpAction({ userId: 'user-1' });

    expect(mockExecute).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toEqual({ success: true, data: { deleted: 2 } });
  });

  it('writes an audit line naming both users', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await resetUserOtpAction({ userId: 'user-1' });

    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('[UserOtpReset]');
    expect(logged).toContain('userId=user-1');
    expect(logged).toContain('superadmin=admin-1');

    logSpy.mockRestore();
  });

  it('translates a use-case failure', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });
    mockExecute.mockResolvedValue({
      success: false,
      error: 'domain.user.userNotFound',
    });

    const result = await resetUserOtpAction({ userId: 'missing' });

    expect(result).toEqual({
      success: false,
      error: 'translated:domain.user.userNotFound',
    });
  });
});
