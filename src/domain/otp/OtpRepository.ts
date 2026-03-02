import { OtpVerification, OtpChannel } from './OtpVerification';

export interface OtpRepository {
  save(otp: OtpVerification): Promise<OtpVerification>;
  findById(id: string): Promise<OtpVerification | null>;
  findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel
  ): Promise<OtpVerification | null>;
  update(otp: OtpVerification): Promise<OtpVerification>;
  countRecentByClientIp(ip: string, sinceHours: number): Promise<number>;
  countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    sinceHours: number
  ): Promise<number>;
  deleteExpired(): Promise<void>;
}
