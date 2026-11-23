/** Reads confirmation status from the same instant and policy used by issuance. */
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurpose } from '@/domain/otp/OtpVerification';
import { OtpDestination } from '@/domain/otp/OtpValues';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Seconds } from '@/domain/auth/AuthValues';
import { readThrottle } from './OtpThrottleCalculator';

export interface OtpStatus {
  // A code was sent to the current address, has not expired and can still be entered.
  readonly hasPendingCode: boolean;
  // Seconds until the throttle allows requesting another code; zero means now.
  readonly retryAfterSeconds: Seconds;
}

export interface OtpStatusQuery {
  readonly userId: UserId;
  // A code sent to a previous address proves nothing about the current one.
  readonly destination: OtpDestination;
  readonly purpose: OtpPurpose;
}

/** Confirmation pages need no browser-held OTP identity to recover this state. */
export async function readOtpStatus(
  otpRepository: OtpRepository,
  query: OtpStatusQuery,
  now: Instant
): Promise<OtpStatus> {
  const latest = await otpRepository.findLatestByUserId(
    query.userId,
    query.purpose
  );
  const throttle = await readThrottle(
    otpRepository,
    query.destination,
    query.purpose,
    now
  );

  return {
    hasPendingCode:
      latest !== null &&
      latest.isPending(now) &&
      latest.identifier === query.destination.identifier,
    retryAfterSeconds: throttle.retryAfterSeconds,
  };
}

/** Login, registration and status pages agree on whether another code is needed. */
export function shouldIssueCode(status: OtpStatus): boolean {
  return !status.hasPendingCode && status.retryAfterSeconds === 0;
}
