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
    locale: string,
    code: string,
    expiryMinutes: number
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
    locale: string,
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
