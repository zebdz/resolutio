/** SMTP adapter serializes validated recipients and never returns live message bodies. */
import nodemailer, { type Transporter } from 'nodemailer';
import type {
  EmailMessage,
  EmailSender,
  EmailSendResult,
} from '@/application/auth/EmailSender';

export interface NodemailerConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: NodemailerConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to.getValue(),
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments,
      });

      // No backdoorPreview: echoing a live code back to the caller (and thence
      // into a log) is exactly what the stub-only affordance exists to avoid.
      return { success: true };
    } catch (error) {
      // Deliberately logs neither the body nor the subject — the body contains
      // a live OTP.
      const smtp = error as { command?: string; responseCode?: number } | null;
      console.error('NodemailerEmailSender send failed');
      // A failure before DATA or a negative SMTP reply establishes non-acceptance.
      // A lost final reply may follow a successful handoff.
      const rejected =
        (smtp?.responseCode ?? 0) >= 400 ||
        [
          'CONN',
          'EHLO',
          'HELO',
          'STARTTLS',
          'AUTH',
          'MAIL FROM',
          'RCPT TO',
        ].includes(smtp?.command ?? '');

      return { success: false, uncertain: !rejected };
    }
  }
}
