'use server';

import { getTranslations } from 'next-intl/server';
import { ChangeUserEmailUseCase } from '@/application/auth/ChangeUserEmailUseCase';
import { RequestEmailConfirmationOtpUseCase } from '@/application/auth/RequestEmailConfirmationOtpUseCase';
import { ConfirmEmailUseCase } from '@/application/auth/ConfirmEmailUseCase';
import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
  OtpCodeHasherImpl,
  createEmailSenderFromEnv,
  createEmailDeliveryChannelFromEnv,
  NextIntlEmailTemplateRenderer,
} from '@/infrastructure/index';
import { getCurrentUser } from '@/web/lib/session';
import { getClientIp } from '@/web/lib/clientIp';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import type { ActionResult } from '@/web/actions/auth/auth';

const userRepository = new PrismaUserRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

const changeUserEmailUseCase = new ChangeUserEmailUseCase({
  userRepository,
  emailSender: createEmailSenderFromEnv(),
  templateRenderer: new NextIntlEmailTemplateRenderer(),
});

const requestEmailConfirmationOtpUseCase =
  new RequestEmailConfirmationOtpUseCase({
    userRepository,
    otpRepository,
    deliveryChannel: createEmailDeliveryChannelFromEnv(),
    otpCodeHasher,
    expiryMinutes,
  });

const confirmEmailUseCase = new ConfirmEmailUseCase({
  userRepository,
  otpRepository,
  otpCodeHasher,
});

export interface EmailOtpIssued {
  otpId: string;
  expiresInSeconds: number;
  backdoorCode?: string;
}

export async function updateEmailAction(
  formData: FormData
): Promise<ActionResult<EmailOtpIssued | null>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const changed = await changeUserEmailUseCase.execute({
      userId: currentUser.id,
      email: (formData.get('email') as string) ?? '',
    });

    if (!changed.success) {
      return { success: false, error: await translateErrorCode(changed.error) };
    }

    // Saving an address is only half the job — it is useless until confirmed,
    // so the code goes out in the same step rather than behind a second click.
    const issued = await requestEmailConfirmationOtpUseCase.execute({
      userId: currentUser.id,
      clientIp: await getClientIp(),
    });

    if (!issued.success) {
      return { success: false, error: await translateErrorCode(issued.error) };
    }

    return {
      success: true,
      data: {
        otpId: issued.value.otpId,
        expiresInSeconds: issued.value.expiresInSeconds,
        backdoorCode: issued.value.backdoorCode,
      },
    };
  } catch (error) {
    console.error('Update email action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function requestEmailConfirmationAction(): Promise<
  ActionResult<EmailOtpIssued>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const issued = await requestEmailConfirmationOtpUseCase.execute({
      userId: currentUser.id,
      clientIp: await getClientIp(),
    });

    if (!issued.success) {
      return { success: false, error: await translateErrorCode(issued.error) };
    }

    return {
      success: true,
      data: {
        otpId: issued.value.otpId,
        expiresInSeconds: issued.value.expiresInSeconds,
        backdoorCode: issued.value.backdoorCode,
      },
    };
  } catch (error) {
    console.error('Request email confirmation action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}

export async function confirmEmailAction(
  formData: FormData
): Promise<ActionResult<{ confirmed: true }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const tCommon = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: tCommon('unauthorized') };
    }

    const result = await confirmEmailUseCase.execute({
      // From the session, never the form — the form supplies only the code.
      userId: currentUser.id,
      otpId: (formData.get('otpId') as string) ?? '',
      code: (formData.get('code') as string) ?? '',
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: { confirmed: true } };
  } catch (error) {
    console.error('Confirm email action error:', error);

    return { success: false, error: tCommon('unexpected') };
  }
}
