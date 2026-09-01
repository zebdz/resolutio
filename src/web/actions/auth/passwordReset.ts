'use server';

import { getTranslations } from 'next-intl/server';
import { RequestPasswordResetUseCase } from '@/application/auth/RequestPasswordResetUseCase';
import { ResetPasswordWithOtpUseCase } from '@/application/auth/ResetPasswordWithOtpUseCase';
import { resetPasswordSchema } from '@/application/auth/ResetPasswordSchema';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  PrismaSessionRepository,
  OtpCodeHasherImpl,
  Argon2PasswordHasher,
  createEmailDeliveryChannelFromEnv,
  TurnstileCaptchaVerifier,
  isCaptchaEnforced,
} from '@/infrastructure/index';
import { getClientIp } from '@/web/lib/clientIp';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import type { ActionResult } from './auth';

const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const captchaVerifier = new TurnstileCaptchaVerifier(
  process.env.TURNSTILE_SECRET_KEY || ''
);

const requestPasswordResetUseCase = new RequestPasswordResetUseCase({
  userRepository,
  otpRepository,
  deliveryChannel: createEmailDeliveryChannelFromEnv(),
  otpCodeHasher,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});

const resetPasswordWithOtpUseCase = new ResetPasswordWithOtpUseCase({
  userRepository,
  otpRepository,
  sessionRepository,
  otpCodeHasher,
  passwordHasher: new Argon2PasswordHasher(),
});

/**
 * Both actions here are unauthenticated, so both are CAPTCHA-gated. A missing
 * token is a failure rather than a reason to skip the check — otherwise
 * omitting the field opts a client out of it.
 */
async function captchaRejection(
  captchaToken: string | undefined,
  clientIp: string
): Promise<{ success: false; error: string } | null> {
  if (isCaptchaEnforced() && !captchaToken) {
    const tOtp = await getTranslations('otp.errors');

    return { success: false, error: tOtp('captchaFailed') };
  }

  if (captchaToken && !(await captchaVerifier.verify(captchaToken, clientIp))) {
    const tOtp = await getTranslations('otp.errors');

    return { success: false, error: tOtp('captchaFailed') };
  }

  return null;
}

export async function requestPasswordResetAction(
  formData: FormData,
  captchaToken?: string
): Promise<ActionResult<{ requested: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const clientIp = await getClientIp();
    const rejected = await captchaRejection(captchaToken, clientIp);

    if (rejected) {
      return rejected;
    }

    const result = await requestPasswordResetUseCase.execute({
      identifier: (formData.get('identifier') as string) ?? '',
      clientIp,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { requested: true } };
  } catch (error) {
    console.error('Request password reset action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function resetPasswordWithOtpAction(
  formData: FormData,
  captchaToken?: string
): Promise<ActionResult<{ reset: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const clientIp = await getClientIp();
    const rejected = await captchaRejection(captchaToken, clientIp);

    if (rejected) {
      return rejected;
    }

    const parsed = resetPasswordSchema.safeParse({
      identifier: (formData.get('identifier') as string) ?? '',
      code: (formData.get('code') as string) ?? '',
      password: (formData.get('password') as string) ?? '',
      confirmPassword: (formData.get('confirmPassword') as string) ?? '',
    });

    if (!parsed.success) {
      return {
        success: false,
        error: await translateErrorCode(parsed.error.issues[0].message),
      };
    }

    const result = await resetPasswordWithOtpUseCase.execute({
      identifier: parsed.data.identifier,
      code: parsed.data.code,
      newPassword: parsed.data.password,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { reset: true } };
  } catch (error) {
    console.error('Reset password action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}
