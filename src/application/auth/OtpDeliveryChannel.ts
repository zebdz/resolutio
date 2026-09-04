import { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';

export interface OtpDeliveryResult {
  success: boolean;
  backdoorCode?: string;
}

export interface OtpDeliveryChannel {
  channel: OtpChannel;
  send(
    recipient: string,
    code: string,
    locale: string,
    clientIp: string,
    // Lets a channel pick its template. SMS ignores it for now; the email
    // channel needs it to tell "confirm your address" from "reset your
    // password".
    purpose: OtpPurpose
  ): Promise<OtpDeliveryResult>;
}
