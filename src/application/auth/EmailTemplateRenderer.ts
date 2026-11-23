import type { OtpPurpose } from '@/domain/otp/OtpVerification';
import type { OtpDigits } from '@/domain/otp/OtpValues';
import type { Minutes } from '@/domain/auth/AuthValues';
import type { Language } from '@/domain/user/UserValues';

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
    locale: Language,
    code: OtpDigits,
    expiryMinutes: Minutes
  ): Promise<RenderedEmail>;

  renderEmailChangedNotice(
    locale: Language,
    newEmailMasked: string
  ): Promise<RenderedEmail>;
}
