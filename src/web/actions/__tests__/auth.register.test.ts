import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegisterExecute = vi.fn();
const mockSetSessionCookie = vi.fn();

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {},
  PrismaSessionRepository: class {},
  PrismaOtpRepository: class {},
  Argon2PasswordHasher: class {},
  Argon2PasswordVerifier: class {},
  OtpCodeHasherImpl: class {},
  createSmsDeliveryChannelFromEnv: () => ({}),
  createEmailDeliveryChannelFromEnv: () => ({}),
  TurnstileCaptchaVerifier: class {},
  isCaptchaEnforced: () => false,
}));

vi.mock('@/application/auth/RegisterUserUseCase', () => ({
  RegisterUserUseCase: class {
    execute = mockRegisterExecute;
  },
}));

vi.mock('@/application/auth/LoginUserUseCase', () => ({
  LoginUserUseCase: class {},
}));

vi.mock('@/application/auth/LogoutUserUseCase', () => ({
  LogoutUserUseCase: class {},
}));

vi.mock('@/infrastructure/rateLimit/superadminWhitelist', () => ({
  registerSuperadminAccess: vi.fn(),
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
  setSessionCookie: mockSetSessionCookie,
  getSessionCookie: vi.fn().mockResolvedValue(undefined),
  deleteSessionCookie: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
  getLocale: vi.fn().mockResolvedValue('en'),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: () => 'test-agent' }),
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() }),
}));

// permanentRedirect is unused here, but next-intl's createNavigation wraps both
// at import time and throws if either is missing.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

const { registerAction } = await import('../auth/auth');

function makeFormData(): FormData {
  const fd = new FormData();
  fd.set('firstName', 'John');
  fd.set('lastName', 'Doe');
  fd.set('middleName', '');
  fd.set('phoneNumber', '+79161234567');
  fd.set('email', '');
  fd.set('password', 'correct-horse-battery-staple');
  fd.set('confirmPassword', 'correct-horse-battery-staple');
  fd.set('language', 'en');
  fd.set('consentGiven', 'true');

  return fd;
}

const OTP_WINDOW_SECONDS = 600;
const SESSION_TTL_SECONDS = 86_400;

const successResult = {
  success: true,
  value: {
    user: { id: 'user-1' },
    session: { id: 'sess-1' },
    sessionExpiresInSeconds: SESSION_TTL_SECONDS,
    otpId: 'otp-1',
    expiresAt: new Date('2026-09-09T12:10:00Z'),
    expiresInSeconds: OTP_WINDOW_SECONDS,
  },
};

describe('registerAction — session cookie lifetime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterExecute.mockResolvedValue(successResult);
  });

  it('sets the session cookie for the session TTL, not the OTP window', async () => {
    const result = await registerAction(makeFormData());

    expect(result.success).toBe(true);
    expect(mockSetSessionCookie).toHaveBeenCalledWith(
      'sess-1',
      SESSION_TTL_SECONDS
    );
  });

  it('still hands the OTP window to the client', async () => {
    const result = await registerAction(makeFormData());

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.expiresInSeconds).toBe(OTP_WINDOW_SECONDS);
    }
  });
});
