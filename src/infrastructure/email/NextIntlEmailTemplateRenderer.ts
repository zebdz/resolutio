/** Renders validated authentication purposes, locales and time units into email text. */
import { Language } from '@/domain/user/UserValues';
import { OtpDigits } from '@/domain/otp/OtpValues';
import { Minutes } from '@/domain/auth/AuthValues';
import { getTranslations } from 'next-intl/server';
import type {
  EmailTemplateRenderer,
  RenderedEmail,
} from '@/application/auth/EmailTemplateRenderer';
import { OtpPurposes, type OtpPurpose } from '@/domain/otp/OtpVerification';

const NAMESPACE_BY_PURPOSE: Record<OtpPurpose, string> = {
  [OtpPurposes.PHONE_CONFIRMATION]: 'email.otp.phoneConfirmation',
  [OtpPurposes.EMAIL_CONFIRMATION]: 'email.otp.emailConfirmation',
  [OtpPurposes.PASSWORD_RESET]: 'email.otp.passwordReset',
};

export class NextIntlEmailTemplateRenderer implements EmailTemplateRenderer {
  async renderOtp(
    purpose: OtpPurpose,
    locale: Language,
    code: OtpDigits,
    expiryMinutes: Minutes
  ): Promise<RenderedEmail> {
    const t = await getTranslations({
      locale,
      namespace: NAMESPACE_BY_PURPOSE[purpose],
    });

    return {
      subject: t('subject'),
      text: t('body', { code, minutes: expiryMinutes }),
    };
  }

  async renderEmailChangedNotice(
    locale: Language,
    newEmailMasked: string
  ): Promise<RenderedEmail> {
    const t = await getTranslations({
      locale,
      namespace: 'email.notifications.emailChanged',
    });

    return {
      subject: t('subject'),
      text: t('body', { newEmail: newEmailMasked }),
    };
  }
}
