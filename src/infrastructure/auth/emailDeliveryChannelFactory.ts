import type { OtpDeliveryChannel } from '@/application/auth/OtpDeliveryChannel';
import { otpExpiryMinutesFromEnv } from './otpConfiguration';
import { EmailOtpDeliveryChannel } from './EmailOtpDeliveryChannel';
import { NextIntlEmailTemplateRenderer } from '../email/NextIntlEmailTemplateRenderer';
import { createEmailSenderFromEnv } from '../email/emailSenderFactory';

/**
 * Build the OTP email delivery channel from environment configuration.
 * Mirrors createSmsDeliveryChannelFromEnv so the two channels are wired the
 * same way at every call site.
 */
export function createEmailDeliveryChannelFromEnv(): OtpDeliveryChannel<'email'> {
  return new EmailOtpDeliveryChannel({
    emailSender: createEmailSenderFromEnv(),
    templateRenderer: new NextIntlEmailTemplateRenderer(),
    expiryMinutes: otpExpiryMinutesFromEnv(),
  });
}
