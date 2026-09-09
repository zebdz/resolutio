import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted, because the action module builds its use cases at module scope
// (the pattern confirmPhone.ts already uses). The mock class constructors
// therefore run during import — before plain `const` mocks would initialize.
const {
  checkRateLimit,
  getCurrentUser,
  changeEmailExecute,
  requestOtpExecute,
  confirmEmailExecute,
} = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getCurrentUser: vi.fn(),
  changeEmailExecute: vi.fn(),
  requestOtpExecute: vi.fn(),
  confirmEmailExecute: vi.fn(),
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: () => checkRateLimit(),
}));
vi.mock('@/web/lib/session', () => ({
  getCurrentUser: () => getCurrentUser(),
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
  OtpCodeHasherImpl: class {},
  createEmailSenderFromEnv: () => ({ send: vi.fn() }),
  createEmailDeliveryChannelFromEnv: () => ({
    channel: 'email',
    send: vi.fn(),
  }),
  NextIntlEmailTemplateRenderer: class {},
}));
vi.mock('@/application/auth/ChangeUserEmailUseCase', () => ({
  ChangeUserEmailUseCase: class {
    execute = changeEmailExecute;
  },
}));
vi.mock('@/application/auth/RequestEmailConfirmationOtpUseCase', () => ({
  RequestEmailConfirmationOtpUseCase: class {
    execute = requestOtpExecute;
  },
}));
vi.mock('@/application/auth/ConfirmEmailUseCase', () => ({
  ConfirmEmailUseCase: class {
    execute = confirmEmailExecute;
  },
}));

import {
  updateEmailAction,
  requestEmailConfirmationAction,
  confirmEmailAction,
} from '../user/email';

function emailForm(email = 'ivan@mail.ru') {
  const form = new FormData();
  form.set('email', email);

  return form;
}

beforeEach(() => {
  checkRateLimit.mockReset().mockResolvedValue(null);
  getCurrentUser.mockReset().mockResolvedValue({ id: 'user-1' });
  changeEmailExecute
    .mockReset()
    .mockResolvedValue({ success: true, value: { changed: true } });
  requestOtpExecute.mockReset().mockResolvedValue({
    success: true,
    value: { retryAfterSeconds: 60 },
  });
  confirmEmailExecute
    .mockReset()
    .mockResolvedValue({ success: true, value: { confirmed: true } });
});

describe('updateEmailAction', () => {
  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await updateEmailAction(emailForm());

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(changeEmailExecute).not.toHaveBeenCalled();
  });

  it('refuses when there is no session', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await updateEmailAction(emailForm());

    expect(result.success).toBe(false);
    expect(changeEmailExecute).not.toHaveBeenCalled();
  });

  it('changes the address and immediately sends a confirmation code', async () => {
    const result = await updateEmailAction(emailForm());

    expect(result.success).toBe(true);
    expect(changeEmailExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });
    expect(requestOtpExecute).toHaveBeenCalled();

    if (result.success) {
      expect(result.data).toStrictEqual({ retryAfterSeconds: 60 });
    }
  });

  it('surfaces the domain error and sends nothing when the change is rejected', async () => {
    changeEmailExecute.mockResolvedValue({
      success: false,
      error: 'domain.user.emailTaken',
    });

    const result = await updateEmailAction(emailForm());

    expect(result).toEqual({
      success: false,
      error: 'domain.user.emailTaken',
    });
    expect(requestOtpExecute).not.toHaveBeenCalled();
  });

  // The user id must come from the session, never from the submitted form.
  it('ignores a userId smuggled in through the form', async () => {
    const form = emailForm();
    form.set('userId', 'someone-else');

    await updateEmailAction(form);

    expect(changeEmailExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'ivan@mail.ru',
    });
  });
});

describe('requestEmailConfirmationAction', () => {
  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await requestEmailConfirmationAction();

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(requestOtpExecute).not.toHaveBeenCalled();
  });

  it('refuses when there is no session', async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await requestEmailConfirmationAction();

    expect(result.success).toBe(false);
    expect(requestOtpExecute).not.toHaveBeenCalled();
  });

  it('returns when the next code may be requested, and nothing else', async () => {
    const result = await requestEmailConfirmationAction();

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toStrictEqual({ retryAfterSeconds: 60 });
    }
  });
});

describe('confirmEmailAction', () => {
  function confirmForm() {
    const form = new FormData();
    form.set('code', '123456');

    return form;
  }

  it('refuses before doing any work when rate limited', async () => {
    checkRateLimit.mockResolvedValue({ success: false, error: 'too many' });

    const result = await confirmEmailAction(confirmForm());

    expect(result).toEqual({ success: false, error: 'too many' });
    expect(confirmEmailExecute).not.toHaveBeenCalled();
  });

  it('confirms with the session user and the code, nothing else', async () => {
    const result = await confirmEmailAction(confirmForm());

    expect(result.success).toBe(true);
    expect(confirmEmailExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      code: '123456',
    });
  });

  // The pending code is resolved server-side from the user; an id in the
  // form must not steer it.
  it('ignores an otp id smuggled in through the form', async () => {
    const form = confirmForm();
    form.set('otpId', 'otp-x');

    await confirmEmailAction(form);

    expect(confirmEmailExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      code: '123456',
    });
  });

  it('surfaces a rejected code', async () => {
    confirmEmailExecute.mockResolvedValue({
      success: false,
      error: 'otp.errors.invalid',
    });

    const result = await confirmEmailAction(confirmForm());

    expect(result).toEqual({ success: false, error: 'otp.errors.invalid' });
  });
});
