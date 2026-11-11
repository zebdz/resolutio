/** Adapts typed OTP delivery to localized email and preserves the development preview. */
import { Minutes, ClientIp } from '@/domain/auth/AuthValues';
import {
  OtpDigits,
  OtpRecipient,
  OtpEmailDestination,
} from '@/domain/otp/OtpValues';
import { Language } from '@/domain/user/UserValues';
import { EmailAddress } from '@/domain/user/EmailAddress';
import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { EmailSender } from '@/application/auth/EmailSender';
import type { EmailTemplateRenderer } from '@/application/auth/EmailTemplateRenderer';
import type { OtpPurpose } from '@/domain/otp/OtpVerification';

interface Dependencies {
  emailSender: EmailSender;
  templateRenderer: EmailTemplateRenderer;
  expiryMinutes: Minutes;
}

export class EmailOtpDeliveryChannel implements OtpDeliveryChannel<'email'> {
  readonly channel = 'email' as const;

  private readonly emailSender: EmailSender;
  private readonly templateRenderer: EmailTemplateRenderer;
  private readonly expiryMinutes: Minutes;

  constructor(deps: Dependencies) {
    this.emailSender = deps.emailSender;
    this.templateRenderer = deps.templateRenderer;
    this.expiryMinutes = deps.expiryMinutes;
  }

  async send(
    recipient: OtpRecipient<'email'>,
    code: OtpDigits,
    locale: Language,
    _clientIp: ClientIp,
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult> {
    const destination = OtpEmailDestination.safeParse({
      channel: this.channel,
      identifier: recipient,
    });

    if (!destination.success) {
      return { success: false };
    }

    const { subject, text } = await this.templateRenderer.renderOtp(
      purpose,
      locale,
      code,
      this.expiryMinutes
    );

    const result = await this.emailSender.send({
      to: EmailAddress.create(destination.data.identifier),
      subject,
      text,
    });

    // backdoorPreview is populated by the stub only, so this is how a
    // developer reads the code when no SMTP host is configured.
    return { success: result.success, backdoorCode: result.backdoorPreview };
  }
}
