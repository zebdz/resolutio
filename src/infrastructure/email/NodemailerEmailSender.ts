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
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      // No backdoorPreview: echoing a live code back to the caller (and thence
      // into a log) is exactly what the stub-only affordance exists to avoid.
      return { success: true };
    } catch (error) {
      // Deliberately logs neither the body nor the subject — the body contains
      // a live OTP.
      console.error(
        'NodemailerEmailSender send failed:',
        error instanceof Error ? error.message : error
      );

      return { success: false };
    }
  }
}
