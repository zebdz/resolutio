import type { OtpPurpose } from '@/domain/otp/OtpVerification';

export interface RenderedEmail {
  subject: string;
  text: string;
}

/**
 * Renders localized email bodies. A port rather than a direct next-intl call
 * so the delivery channel stays unit-testable without a request context.
 */
export interface EmailTemplateRenderer {
  renderOtp(
    purpose: OtpPurpose,
    locale: string,
    code: string,
    expiryMinutes: number
  ): Promise<RenderedEmail>;

  renderEmailChangedNotice(
    locale: string,
    newEmailMasked: string
  ): Promise<RenderedEmail>;
}
