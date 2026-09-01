import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { EmailSender } from '@/application/auth/EmailSender';
import type { EmailTemplateRenderer } from '@/application/auth/EmailTemplateRenderer';
import type { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';

interface Dependencies {
  emailSender: EmailSender;
  templateRenderer: EmailTemplateRenderer;
  expiryMinutes: number;
}

export class EmailOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'email';

  private readonly emailSender: EmailSender;
  private readonly templateRenderer: EmailTemplateRenderer;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.emailSender = deps.emailSender;
    this.templateRenderer = deps.templateRenderer;
    this.expiryMinutes = deps.expiryMinutes;
  }

  async send(
    recipient: string,
    code: string,
    locale: string,
    _clientIp: string,
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult> {
    const { subject, text } = await this.templateRenderer.renderOtp(
      purpose,
      locale,
      code,
      this.expiryMinutes
    );

    const result = await this.emailSender.send({
      to: recipient,
      subject,
      text,
    });

    // backdoorPreview is populated by the stub only, so this is how a
    // developer reads the code when no SMTP host is configured.
    return { success: result.success, backdoorCode: result.backdoorPreview };
  }
}
