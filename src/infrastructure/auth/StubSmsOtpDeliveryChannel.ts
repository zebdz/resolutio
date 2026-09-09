import type {
  OtpDeliveryChannel,
  OtpDeliveryResult,
} from '@/application/auth/OtpDeliveryChannel';
import type { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';

/**
 * Stub SMS delivery channel — does not send real SMS.
 * Returns the plaintext code as backdoorCode for display in UI.
 */
export class StubSmsOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'sms';

  async send(
    _recipient: string,
    code: string,
    _locale: string,
    _clientIp: string,
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
