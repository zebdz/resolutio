import { OtpVerification, OtpChannel, OtpPurpose } from './OtpVerification';

export interface OtpRepository {
  save(otp: OtpVerification): Promise<OtpVerification>;
  findById(id: string): Promise<OtpVerification | null>;
  findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null>;
  // The latest code minted for a user for one purpose, whatever address or
  // channel it went to. Phone confirmation resolves its code this way: the
  // user is known from the session, and the client holds no otp id.
  findLatestByUserId(
    userId: string,
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
  // Superadmin reset: drops every code issued to the user, so the throttle
  // for their phone and email (which counts those rows) restarts and a fresh
  // code can go out at once. Returns how many rows went.
  deleteAllForUser(userId: string): Promise<number>;
  deleteExpired(): Promise<void>;
}
