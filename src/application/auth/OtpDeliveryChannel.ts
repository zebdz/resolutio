import { OtpChannel } from '@/domain/otp/OtpVerification';

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
    clientIp: string
  ): Promise<OtpDeliveryResult>;
}
