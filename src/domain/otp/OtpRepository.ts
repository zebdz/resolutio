import { OtpVerification, OtpChannel, OtpPurpose } from './OtpVerification';

export interface OtpRepository {
  save(otp: OtpVerification): Promise<OtpVerification>;
  findById(id: string): Promise<OtpVerification | null>;
  findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null>;
  update(otp: OtpVerification): Promise<OtpVerification>;
  // Deliberately purpose-agnostic: this is the global per-IP ceiling and
  // should count every code an address caused, whatever it was for.
  countRecentByClientIp(ip: string, sinceHours: number): Promise<number>;
  countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    sinceHours: number
  ): Promise<number>;
  deleteExpired(): Promise<void>;
}
