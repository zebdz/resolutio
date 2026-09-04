import type { OtpDeliveryChannel } from '@/application/auth/OtpDeliveryChannel';
import { EmailOtpDeliveryChannel } from './EmailOtpDeliveryChannel';
import { NextIntlEmailTemplateRenderer } from '../email/NextIntlEmailTemplateRenderer';
import { createEmailSenderFromEnv } from '../email/emailSenderFactory';

/**
 * Build the OTP email delivery channel from environment configuration.
 * Mirrors createSmsDeliveryChannelFromEnv so the two channels are wired the
 * same way at every call site.
 */
export function createEmailDeliveryChannelFromEnv(): OtpDeliveryChannel {
  return new EmailOtpDeliveryChannel({
    emailSender: createEmailSenderFromEnv(),
    templateRenderer: new NextIntlEmailTemplateRenderer(),
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  });
}
