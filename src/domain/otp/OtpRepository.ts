/** Persistence port for purpose-scoped OTP state and explicit throttle cutoffs.
 * Repositories receive validated identities and times rather than reading a clock. */
/** OTP persistence port accepts validated identity and caller-supplied time bounds. */
import { UserId, OtpVerificationId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { ClientIp } from '../auth/AuthValues';
import { OtpDestination, OtpCount } from './OtpValues';
import { OtpVerification, OtpPurpose } from './OtpVerification';

export interface OtpRepository {
  save(otp: OtpVerification): Promise<OtpVerification>;
  findById(id: OtpVerificationId): Promise<OtpVerification | null>;
  findLatestByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null>;
  // The latest code minted for a user for one purpose, whatever address or
  // channel it went to. Phone confirmation resolves its code this way: the
  // user is known from the session, and the client holds no otp id.
  findLatestByUserId(
    userId: UserId,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null>;
  update(otp: OtpVerification): Promise<OtpVerification>;
  // Deliberately purpose-agnostic: this is the global per-IP ceiling and
  // should count every code an address caused, whatever it was for.
  countRecentByClientIp(ip: ClientIp, since: Instant): Promise<OtpCount>;
  countRecentByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose,
    since: Instant
  ): Promise<OtpCount>;
  // Superadmin reset: drops every code issued to the user, so the throttle
  // for their phone and email (which counts those rows) restarts and a fresh
  // code can go out at once. Returns how many rows went.
  deleteAllForUser(userId: UserId): Promise<OtpCount>;
  deleteExpired(now: Instant): Promise<void>;
}
