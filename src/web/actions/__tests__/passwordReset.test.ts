import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted: the action module builds its use cases at module scope, so the
// mock class constructors run during import.
const {
  checkRateLimit,
  requestExecute,
  resetExecute,
  captchaVerify,
  captchaEnforced,
} = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  requestExecute: vi.fn(),
  resetExecute: vi.fn(),
  captchaVerify: vi.fn(),
  captchaEnforced: vi.fn(),
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: () => checkRateLimit(),
}));
vi.mock('@/web/lib/clientIp', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => code,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {},
  PrismaOtpRepository: class {},
  PrismaSessionRepository: class {},
  OtpCodeHasherImpl: class {},
  Argon2PasswordHasher: class {},
  createEmailDeliveryChannelFromEnv: () => ({
    channel: 'email',
    send: vi.fn(),
  }),
  TurnstileCaptchaVerifier: class {
    verify = captchaVerify;
  },
  isCaptchaEnforced: () => captchaEnforced(),
}));
vi.mock('@/application/auth/RequestPasswordResetUseCase', () => ({
  RequestPasswordResetUseCase: class {
    execute = requestExecute;
  },
}));
vi.mock('@/application/auth/ResetPasswordWithOtpUseCase', () => ({
  ResetPasswordWithOtpUseCase: class {
    execute = resetExecute;
  },
}));

import {
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
} from '../auth/passwordReset';

beforeEach(() => {
  checkRateLimit.mockReset().mockResolvedValue(null);
  captchaEnforced.mockReset().mockReturnValue(false);
  captchaVerify.mockReset().mockResolvedValue(true);
  requestExecute
    .mockReset()
    .mockResolvedValue({ success: true, value: { requested: true } });
  resetExecute
    .mockReset()
    .mockResolvedValue({ success: true, value: { reset: true } });
});

function identifierForm(identifier = 'ivan@mail.ru') {
  const form = new FormData();
  form.set('identifier', identifier);

  return form;
}

describe('requestPasswordResetAction', () => {
  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await requestPasswordResetAction(identifierForm());

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(requestExecute).not.toHaveBeenCalled();
  });

  // An unauthenticated endpoint that sends mail has no other cost ceiling.
  it('refuses when CAPTCHA is enforced and no token is supplied', async () => {
    captchaEnforced.mockReturnValue(true);

    const result = await requestPasswordResetAction(identifierForm());

    expect(result.success).toBe(false);
    expect(requestExecute).not.toHaveBeenCalled();
  });

  it('refuses when the CAPTCHA token does not verify', async () => {
    captchaEnforced.mockReturnValue(true);
    captchaVerify.mockResolvedValue(false);

    const result = await requestPasswordResetAction(
      identifierForm(),
      'a-token'
    );

    expect(result.success).toBe(false);
    expect(requestExecute).not.toHaveBeenCalled();
  });

  it('proceeds when the CAPTCHA token verifies', async () => {
    captchaEnforced.mockReturnValue(true);

    const result = await requestPasswordResetAction(
      identifierForm(),
      'a-token'
    );

    expect(result.success).toBe(true);
    expect(requestExecute).toHaveBeenCalled();
  });

  it('reports success for an account that does not exist', async () => {
    const result = await requestPasswordResetAction(
      identifierForm('nobody@mail.ru')
    );

    expect(result.success).toBe(true);
  });
});

describe('resetPasswordWithOtpAction', () => {
  function buildForm(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set('identifier', 'ivan@mail.ru');
    form.set('code', '123456');
    form.set('password', 'Korova-Zabor-71');
    form.set('confirmPassword', 'Korova-Zabor-71');

    Object.entries(overrides).forEach(([key, value]) => form.set(key, value));

    return form;
  }

  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(resetExecute).not.toHaveBeenCalled();
  });

  it('is CAPTCHA-gated too', async () => {
    captchaEnforced.mockReturnValue(true);

    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result.success).toBe(false);
    expect(resetExecute).not.toHaveBeenCalled();
  });

  it('rejects mismatched confirmation before reaching the use case', async () => {
    const result = await resetPasswordWithOtpAction(
      buildForm({ confirmPassword: 'something-else' })
    );

    expect(result.success).toBe(false);
    expect(resetExecute).not.toHaveBeenCalled();
  });

  it('passes a valid submission through to the use case', async () => {
    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result.success).toBe(true);
    expect(resetExecute).toHaveBeenCalledWith({
      identifier: 'ivan@mail.ru',
      code: '123456',
      newPassword: 'Korova-Zabor-71',
    });
  });

  it('surfaces a rejected code', async () => {
    resetExecute.mockResolvedValue({
      success: false,
      error: 'otp.errors.invalid',
    });

    const result = await resetPasswordWithOtpAction(buildForm());

    expect(result).toEqual({ success: false, error: 'otp.errors.invalid' });
  });
});
