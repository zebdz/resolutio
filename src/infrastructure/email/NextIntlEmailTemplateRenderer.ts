/** Renders validated authentication and private poll evidence in the recipient’s language. */
import { EvidenceTemplate } from '@/application/seal/EvidenceMail';
import { createTranslator } from 'next-intl';
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

export class NextIntlEmailTemplateRenderer
  implements EmailTemplateRenderer, EvidenceTemplate
{
  async renderEvidence(
    kind: 'voteReceipt' | 'sealBundle',
    locale: Language,
    values: Record<string, string>
  ) {
    // Recovery runs outside a browser request. Select the recipient's catalog explicitly.
    const messages =
      locale === 'ru'
        ? (await import('@/messages/ru.json')).default
        : (await import('@/messages/en.json')).default;
    const t = createTranslator({
      locale,
      messages,
      namespace:
        kind === 'voteReceipt' ? 'email.voteReceipt' : 'email.sealBundle',
    });
    const text = t('body', values);
    const html =
      '<div style="white-space:pre-wrap">' +
      text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;') +
      '</div>';

    return { subject: t('subject'), text, html };
  }

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
