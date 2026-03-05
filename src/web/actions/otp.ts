'use server';

import { getTranslations } from 'next-intl/server';
import { RequestOtpUseCase } from '@/application/auth/RequestOtpUseCase';
import { VerifyOtpUseCase } from '@/application/auth/VerifyOtpUseCase';
import { OtpErrors } from '@/application/auth/OtpErrors';
import {
  prisma,
  PrismaOtpRepository,
  OtpCodeHasherImpl,
  StubSmsOtpDeliveryChannel,
  TurnstileCaptchaVerifier,
} from '@/infrastructure/index';
import { getClientIp } from '@/web/lib/clientIp';
import { checkRateLimit } from '@/web/actions/rateLimit';
import type { ActionResult } from './auth';

// Initialize dependencies
const otpRepository = new PrismaOtpRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const deliveryChannel = new StubSmsOtpDeliveryChannel();
const captchaVerifier = new TurnstileCaptchaVerifier(
  process.env.TURNSTILE_SECRET_KEY || ''
);

const requestOtpUseCase = new RequestOtpUseCase({
  otpRepository,
  captchaVerifier,
  otpCodeHasher,
  deliveryChannel,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});

const verifyOtpUseCase = new VerifyOtpUseCase({
  otpRepository,
  otpCodeHasher,
});

export async function requestOtpAction(
  formData: FormData
): Promise<
  ActionResult<{ otpId: string; expiresAt: string; backdoorCode?: string }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {return rateLimited;}

  const t = await getTranslations('otp.errors');
  const tCommon = await getTranslations('common.errors');

  try {
    const phoneNumber = formData.get('phoneNumber') as string;
    const captchaToken = formData.get('captchaToken') as string;
    const locale = (formData.get('locale') as string) || 'ru';

    const clientIp = await getClientIp();

    const result = await requestOtpUseCase.execute({
      phoneNumber,
      captchaToken,
      clientIp,
      locale,
    });

    if (!result.success) {
      const errorKey = getOtpErrorTranslationKey(result.error);

      return {
        success: false,
        error: errorKey ? t(errorKey) : result.error,
      };
    }

    return {
      success: true,
      data: {
        otpId: result.value.otpId,
        expiresAt: result.value.expiresAt.toISOString(),
        backdoorCode: result.value.backdoorCode,
      },
    };
  } catch (error) {
    console.error('Request OTP action error:', error);

    return {
      success: false,
      error: tCommon('unexpected'),
    };
  }
}

export async function verifyOtpAction(
  formData: FormData
): Promise<ActionResult<{ verified: boolean }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {return rateLimited;}

  const t = await getTranslations('otp.errors');
  const tCommon = await getTranslations('common.errors');

  try {
    const otpId = formData.get('otpId') as string;
    const code = formData.get('code') as string;

    const result = await verifyOtpUseCase.execute({ otpId, code });

    if (!result.success) {
      const errorKey = getOtpErrorTranslationKey(result.error);

      return {
        success: false,
        error: errorKey ? t(errorKey) : result.error,
      };
    }

    return {
      success: true,
      data: { verified: true },
    };
  } catch (error) {
    console.error('Verify OTP action error:', error);

    return {
      success: false,
      error: tCommon('unexpected'),
    };
  }
}

// Map OtpErrors codes to translation keys under otp.errors.*
function getOtpErrorTranslationKey(error: string): string | null {
  const map: Record<string, string> = {
    [OtpErrors.EXPIRED]: 'expired',
    [OtpErrors.INVALID]: 'invalid',
    [OtpErrors.MAX_ATTEMPTS]: 'maxAttempts',
    [OtpErrors.THROTTLED]: 'throttled',
    [OtpErrors.ALREADY_VERIFIED]: 'alreadyVerified',
    [OtpErrors.NOT_FOUND]: 'notFound',
    [OtpErrors.SEND_FAILED]: 'sendFailed',
    [OtpErrors.CAPTCHA_FAILED]: 'captchaFailed',
    [OtpErrors.NOT_VERIFIED]: 'notVerified',
    [OtpErrors.PHONE_MISMATCH]: 'phoneMismatch',
  };

  return map[error] ?? null;
}
