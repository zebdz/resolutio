/** Serializes validated OTP delivery values into the provider transport. */
import { ClientIp } from '@/domain/auth/AuthValues';
import { OtpDigits, OtpRecipient } from '@/domain/otp/OtpValues';
import { Language } from '@/domain/user/UserValues';
import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { OtpPurpose } from '@/domain/otp/OtpVerification';

/**
 * Stub SMS delivery channel — does not send real SMS.
 * Returns the plaintext code as backdoorCode for display in UI.
 */
export class StubSmsOtpDeliveryChannel implements OtpDeliveryChannel<'sms'> {
  readonly channel = 'sms' as const;

  async send(
    _recipient: OtpRecipient<'sms'>,
    code: OtpDigits,
    _locale: Language,
    _clientIp: ClientIp,
    _purpose: OtpPurpose
  ): Promise<OtpDeliveryResult> {
    // The confirm-phone page no longer receives this code from the register
    // or login step (it reads pending-code state from the server instead), so
    // a local checkout needs it somewhere: the server console.
    console.info(`[stub-sms] code for ${_recipient}: ${code}`);

    // In production this would call sms.ru API
    return { success: true, backdoorCode: code };
  }
}
