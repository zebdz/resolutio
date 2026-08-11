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
  PrismaSessionRepository: vi.fn(),
  Argon2PasswordHasher: vi.fn(),
  CryptoPasswordGenerator: vi.fn(),
}));

vi.mock('@/application/auth/ResetUserPasswordUseCase', () => ({
  ResetUserPasswordUseCase: class {
    execute = mockExecute;
  },
}));

vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: vi.fn(async (code: string) => `translated:${code}`),
}));

const { resetUserPasswordAction } = await import('../superadmin/userPassword');

const AUTH_ERROR = { success: false as const, error: 'Unauthorized' };

describe('resetUserPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({
      success: true,
      value: { password: 'gen3-Rated-Pass' },
    });
  });

  it('rejects non-superadmins without touching the password', async () => {
    mockRequireSuperadmin.mockResolvedValue(AUTH_ERROR);

    const result = await resetUserPasswordAction({ userId: 'user-1' });

    expect(result).toEqual(AUTH_ERROR);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns the generated password to a superadmin', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });

    const result = await resetUserPasswordAction({ userId: 'user-1' });

    expect(mockExecute).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toEqual({
      success: true,
      data: { password: 'gen3-Rated-Pass' },
    });
  });

  it('keeps the password out of the audit log', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await resetUserPasswordAction({ userId: 'user-1' });

    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toContain('[UserPasswordReset]');
    expect(logged).toContain('userId=user-1');
    expect(logged).toContain('superadmin=admin-1');
    expect(logged).not.toContain('gen3-Rated-Pass');

    logSpy.mockRestore();
  });

  it('translates a use-case failure', async () => {
    mockRequireSuperadmin.mockResolvedValue({ userId: 'admin-1' });
    mockExecute.mockResolvedValue({
      success: false,
      error: 'domain.user.userNotFound',
    });

    const result = await resetUserPasswordAction({ userId: 'missing' });

    expect(result).toEqual({
      success: false,
      error: 'translated:domain.user.userNotFound',
    });
  });
});
