import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsSuperAdmin = vi.fn();
const mockLoginExecute = vi.fn();
const mockRegisterSuperadminAccess = vi.fn();
const mockIsCaptchaEnforced = vi.fn();
const mockCaptchaVerify = vi.fn();

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
  createSmsDeliveryChannelFromEnv: () => ({}),
  createEmailDeliveryChannelFromEnv: () => ({}),
  TurnstileCaptchaVerifier: class {
    verify = mockCaptchaVerify;
  },
  isCaptchaEnforced: mockIsCaptchaEnforced,
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

// permanentRedirect is unused here, but next-intl's createNavigation wraps both
// at import time and throws if either is missing.
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

const { loginAction } = await import('../auth/auth');

function makeFormData(
  phone: string,
  password: string,
  captchaToken?: string
): FormData {
  const fd = new FormData();
  fd.set('phoneNumber', phone);
  fd.set('password', password);

  if (captchaToken !== undefined) {
    fd.set('captchaToken', captchaToken);
  }

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
    // Matches a local checkout with no Turnstile secret configured.
    mockIsCaptchaEnforced.mockReturnValue(false);
    mockCaptchaVerify.mockResolvedValue(true);
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

describe('loginAction — CAPTCHA enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoginExecute.mockResolvedValue(successResult);
    mockIsSuperAdmin.mockResolvedValue(false);
    mockCaptchaVerify.mockResolvedValue(true);
  });

  // The bypass this guards: the call site used to verify only when a token was
  // present, so omitting the field skipped the check entirely.
  it('rejects a login carrying no token while enforcement is on', async () => {
    mockIsCaptchaEnforced.mockReturnValue(true);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123')
    );

    expect(result.success).toBe(false);
    expect(mockLoginExecute).not.toHaveBeenCalled();
    expect(mockCaptchaVerify).not.toHaveBeenCalled();
  });

  it('rejects a login whose token fails verification', async () => {
    mockIsCaptchaEnforced.mockReturnValue(true);
    mockCaptchaVerify.mockResolvedValue(false);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123', 'bad-token')
    );

    expect(result.success).toBe(false);
    expect(mockLoginExecute).not.toHaveBeenCalled();
  });

  it('accepts a login whose token verifies', async () => {
    mockIsCaptchaEnforced.mockReturnValue(true);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123', 'good-token')
    );

    expect(result.success).toBe(true);
    expect(mockCaptchaVerify).toHaveBeenCalledWith('good-token', '1.2.3.4');
  });

  // Local dev with no secret: a tokenless login still has to work, or the
  // forms become unusable.
  it('allows a tokenless login while enforcement is off', async () => {
    mockIsCaptchaEnforced.mockReturnValue(false);

    const result = await loginAction(
      makeFormData('+71234567890', 'password123')
    );

    expect(result.success).toBe(true);
    expect(mockCaptchaVerify).not.toHaveBeenCalled();
  });
});

describe('loginAction — payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCaptchaEnforced.mockReturnValue(false);
    mockCaptchaVerify.mockResolvedValue(true);
    mockIsSuperAdmin.mockResolvedValue(false);
  });

  // The confirm-phone page reads its state from the server; the form only
  // needs to know where to go next.
  it('flags an unconfirmed account with nothing about the code', async () => {
    mockLoginExecute.mockResolvedValue({
      success: true,
      value: {
        user: { id: 'user-1' },
        session: { id: 'sess-1' },
        expiresInSeconds: 3600,
        needsConfirmation: true,
      },
    });

    const result = await loginAction(
      makeFormData('+71234567890', 'password123')
    );

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toStrictEqual({
        userId: 'user-1',
        needsConfirmation: true,
      });
    }
  });
});
