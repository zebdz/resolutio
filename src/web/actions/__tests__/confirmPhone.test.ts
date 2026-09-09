import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockConfirmExecute = vi.fn();
const mockRequestExecute = vi.fn();
const mockIsCaptchaEnforced = vi.fn();
const mockCaptchaVerify = vi.fn();

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {},
  PrismaOtpRepository: class {},
  OtpCodeHasherImpl: class {},
  createSmsDeliveryChannelFromEnv: () => ({}),
  TurnstileCaptchaVerifier: class {
    verify = mockCaptchaVerify;
  },
  isCaptchaEnforced: mockIsCaptchaEnforced,
}));

vi.mock('@/application/auth/ConfirmPhoneUseCase', () => ({
  ConfirmPhoneUseCase: class {
    execute = mockConfirmExecute;
  },
}));

vi.mock('@/application/auth/RequestConfirmationOtpUseCase', () => ({
  RequestConfirmationOtpUseCase: class {
    execute = mockRequestExecute;
  },
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/web/lib/clientIp', () => ({
  getClientIp: vi.fn().mockResolvedValue('1.2.3.4'),
}));

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

const { confirmPhoneAction, requestConfirmationOtpAction } =
  await import('../auth/confirmPhone');

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCaptchaEnforced.mockReturnValue(true);
  mockCaptchaVerify.mockResolvedValue(true);
});

describe('confirmPhoneAction', () => {
  // The otp id used to travel through sessionStorage and was gone after a
  // reload; the server resolves the pending code from the session user now.
  it('confirms with just the code from the form', async () => {
    mockConfirmExecute.mockResolvedValue({
      success: true,
      value: { confirmed: true },
    });

    const formData = new FormData();
    formData.set('code', '123456');

    const result = await confirmPhoneAction(formData);

    expect(result.success).toBe(true);
    expect(mockConfirmExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      code: '123456',
    });
  });
});

describe('requestConfirmationOtpAction', () => {
  it('rejects a request without a token when CAPTCHA is enforced', async () => {
    const result = await requestConfirmationOtpAction(undefined);

    expect(result.success).toBe(false);
    expect(mockRequestExecute).not.toHaveBeenCalled();
  });

  it('passes the throttle wait back to the client', async () => {
    mockRequestExecute.mockResolvedValue({
      success: true,
      value: {
        otpId: 'otp-1',
        expiresAt: new Date(),
        expiresInSeconds: 600,
        retryAfterSeconds: 300,
      },
    });

    const result = await requestConfirmationOtpAction('turnstile-token');

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.retryAfterSeconds).toBe(300);
    }
  });
});
