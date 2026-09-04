import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from '@/application/auth/EmailSender';

/**
 * Does not send mail. Logs the message and hands the body back so the flow is
 * exercisable end to end before SMTP credentials exist. Mirrors
 * StubSmsOtpDeliveryChannel.
 */
export class StubEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info(
      `[StubEmailSender] to=${message.to} subject=${message.subject}\n${message.text}`
    );

    return { success: true, backdoorPreview: message.text };
  }
}
