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
    // In production this would call sms.ru API
    return { success: true, backdoorCode: code };
  }
}
