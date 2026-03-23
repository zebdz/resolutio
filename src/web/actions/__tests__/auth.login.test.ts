import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsSuperAdmin = vi.fn();
const mockLoginExecute = vi.fn();
const mockRegisterSuperadminAccess = vi.fn();

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {
    isSuperAdmin = mockIsSuperAdmin;
  },
  PrismaSessionRepository: class {},
  PrismaOtpRepository: class {},
  Argon2PasswordHasher: class {},
  Argon2PasswordVerifier: class {},
  OtpCodeHasherImpl: class {},
  StubSmsOtpDeliveryChannel: class {},
  TurnstileCaptchaVerifier: class {
    verify = vi.fn().mockResolvedValue(true);
  },
}));

vi.mock('@/application/auth/LoginUserUseCase', () => ({
  LoginUserUseCase: class {
    execute = mockLoginExecute;
  },
}));

vi.mock('@/application/auth/RegisterUserUseCase', () => ({
  RegisterUserUseCase: class {},
}));

vi.mock('@/application/auth/LogoutUserUseCase', () => ({
  LogoutUserUseCase: class {},
}));

vi.mock('@/infrastructure/rateLimit/superadminWhitelist', () => ({
  registerSuperadminAccess: mockRegisterSuperadminAccess,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  checkLoginRateLimit: vi.fn().mockResolvedValue(null),
  resetLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  checkRegistrationRateLimit: vi.fn().mockResolvedValue(null),
  recordFailedLogin: vi.fn(),
}));

vi.mock('@/web/lib/clientIp', () => ({
  getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));

vi.mock('@/web/lib/session', () => ({
  setSessionCookie: vi.fn().mockResolvedValue(undefined),
  getSessionCookie: vi.fn().mockResolvedValue(undefined),
  deleteSessionCookie: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: () => 'test-agent' }),
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

const { loginAction } = await import('../auth/auth');

function makeFormData(phone: string, password: string): FormData {
  const fd = new FormData();
  fd.set('phoneNumber', phone);
  fd.set('password', password);

  return fd;
}

const successResult = {
  success: true,
  value: {
    user: { id: 'user-sa' },
    session: { id: 'sess-sa' },
    expiresInSeconds: 3600,
    needsConfirmation: false,
  },
};

describe('loginAction — superadmin whitelist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers superadmin in whitelist after login', async () => {
    mockLoginExecute.mockResolvedValue(successResult);
    mockIsSuperAdmin.mockResolvedValue(true);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123')
    );

    expect(result.success).toBe(true);
    expect(mockRegisterSuperadminAccess).toHaveBeenCalledWith(
      '1.2.3.4',
      'user-sa',
      'sess-sa'
    );
  });

  it('does not register non-superadmin in whitelist', async () => {
    mockLoginExecute.mockResolvedValue(successResult);
    mockIsSuperAdmin.mockResolvedValue(false);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123')
    );

    expect(result.success).toBe(true);
    expect(mockRegisterSuperadminAccess).not.toHaveBeenCalled();
  });
});
