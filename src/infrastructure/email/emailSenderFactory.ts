import type { EmailSender } from '@/application/auth/EmailSender';
import { StubEmailSender } from './StubEmailSender';
import { NodemailerEmailSender } from './NodemailerEmailSender';

/**
 * Build the email transport from environment configuration. Keyed on
 * SMTP_HOST the same way createSmsDeliveryChannelFromEnv is keyed on
 * SMS_RU_API_ID, so a deployment without credentials degrades to the stub
 * instead of throwing — and dev/test never send real mail.
 */
export function createEmailSenderFromEnv(): EmailSender {
  const host = process.env.SMTP_HOST;

  if (!host) {
    return new StubEmailSender();
  }

  return new NodemailerEmailSender({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? '',
  });
}
