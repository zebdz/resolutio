'use server';

import { getTranslations } from 'next-intl/server';
import { ConfirmPhoneUseCase } from '@/application/auth/ConfirmPhoneUseCase';
import { RequestConfirmationOtpUseCase } from '@/application/auth/RequestConfirmationOtpUseCase';
import { OtpErrors } from '@/application/auth/OtpErrors';
import { AuthErrors } from '@/application/auth/AuthErrors';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  OtpCodeHasherImpl,
  StubSmsOtpDeliveryChannel,
  SmsRuOtpDeliveryChannel,
  TurnstileCaptchaVerifier,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { getClientIp } from '@/web/lib/clientIp';
import type { ActionResult } from './auth';

// Initialize dependencies
const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const deliveryChannel = process.env.SMS_RU_API_ID
  ? new SmsRuOtpDeliveryChannel({
      apiId: process.env.SMS_RU_API_ID,
      testMode: process.env.SMS_RU_TEST_MODE === 'true',
      maxCost: process.env.SMS_RU_MAX_COST_RUBLES
        ? Number(process.env.SMS_RU_MAX_COST_RUBLES)
        : undefined,
    })
  : new StubSmsOtpDeliveryChannel();
const captchaVerifier = new TurnstileCaptchaVerifier(
  process.env.TURNSTILE_SECRET_KEY || ''
);

const confirmPhoneUseCase = new ConfirmPhoneUseCase({
  otpRepository,
  otpCodeHasher,
  userRepository,
});

const requestConfirmationOtpUseCase = new RequestConfirmationOtpUseCase({
  otpRepository,
  otpCodeHasher,
  deliveryChannel,
  userRepository,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});

// Map OtpErrors codes to translation keys under otp.errors.*
function getOtpErrorTranslationKey(error: string): string | null {
  const map: Record<string, string> = {
    [OtpErrors.EXPIRED]: 'expired',
    [OtpErrors.INVALID]: 'invalid',
    [OtpErrors.MAX_ATTEMPTS]: 'maxAttempts',
    [OtpErrors.THROTTLED]: 'throttled',
    [OtpErrors.NOT_FOUND]: 'notFound',
    [OtpErrors.SEND_FAILED]: 'sendFailed',
  };

  return map[error] ?? null;
}

export async function confirmPhoneAction(
  formData: FormData
): Promise<ActionResult<{ confirmed: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const otpId = formData.get('otpId') as string;
    const code = formData.get('code') as string;

    const result = await confirmPhoneUseCase.execute({
      userId: user.id,
      otpId,
      code,
    });

    if (!result.success) {
      // Handle "already confirmed" distinctly
      if (result.error === AuthErrors.ACCOUNT_NOT_CONFIRMED) {
        const tAuth = await getTranslations('auth.confirmPhone.errors');

        return { success: false, error: tAuth('alreadyConfirmed') };
      }

      const tOtp = await getTranslations('otp.errors');
      const errorKey = getOtpErrorTranslationKey(result.error);

      return {
        success: false,
        error: errorKey ? tOtp(errorKey) : result.error,
      };
    }

    return { success: true, data: { confirmed: true } };
  } catch (error) {
    console.error('Confirm phone action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function requestConfirmationOtpAction(
  captchaToken?: string
): Promise<
  ActionResult<{
    otpId: string;
    expiresAt: string;
    backdoorCode?: string;
    expiresInSeconds: number;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const clientIp = await getClientIp();

    // Verify CAPTCHA
    if (captchaToken) {
      const captchaValid = await captchaVerifier.verify(captchaToken, clientIp);

      if (!captchaValid) {
        const tOtp = await getTranslations('otp.errors');

        return { success: false, error: tOtp('captchaFailed') };
      }
    }

    const result = await requestConfirmationOtpUseCase.execute({
      userId: user.id,
      clientIp,
    });

    if (!result.success) {
      const tOtp = await getTranslations('otp.errors');
      const errorKey = getOtpErrorTranslationKey(result.error);

      return {
        success: false,
        error: errorKey ? tOtp(errorKey) : result.error,
      };
    }

    return {
      success: true,
      data: {
        otpId: result.value.otpId,
        expiresAt: result.value.expiresAt.toISOString(),
        backdoorCode: result.value.backdoorCode,
        expiresInSeconds: result.value.expiresInSeconds,
      },
    };
  } catch (error) {
    console.error('Request confirmation OTP action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}
