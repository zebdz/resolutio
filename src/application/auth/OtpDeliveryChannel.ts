/** Delivery correlates each transport with its validated recipient type; provider-specific payloads belong in adapters. */
import { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';
import { ClientIp } from '@/domain/auth/AuthValues';
import { OtpDigits, OtpRecipient } from '@/domain/otp/OtpValues';
import { Language } from '@/domain/user/UserValues';

export interface OtpDeliveryResult {
  success: boolean;
  /** Stub-only rendered preview; email previews contain prose as well as code digits. */
  backdoorCode?: string;
}

export interface OtpDeliveryChannel<C extends OtpChannel> {
  readonly channel: C;
  send(
    recipient: OtpRecipient<C>,
    code: OtpDigits,
    locale: Language,
    clientIp: ClientIp,
    // Lets a channel pick its template. SMS ignores it for now; the email
    // channel needs it to tell "confirm your address" from "reset your
    // password".
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult>;
}
