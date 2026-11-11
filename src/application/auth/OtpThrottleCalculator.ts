/** Reads persisted OTP facts and delegates deterministic resend policy to the domain. */
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurpose } from '@/domain/otp/OtpVerification';
import { OtpCount, OtpDestination } from '@/domain/otp/OtpValues';
import { beforeSeconds, Seconds } from '@/domain/auth/AuthValues';
import { Instant } from '@/domain/shared/Instant';
import { getRetryAfter } from '@/domain/otp/OtpThrottle';
export {
  calculateThrottleDelay,
  getRetryAfter,
} from '@/domain/otp/OtpThrottle';

export const THROTTLE_WINDOW_SECONDS = Seconds.parse(24 * 60 * 60);

export interface OtpThrottleState {
  // Codes sent to this identifier in the sliding window, the one just sent included.
  readonly recentCount: OtpCount;
  // Seconds until the next code may be requested; zero means right away.
  readonly retryAfterSeconds: Seconds;
}

/** Shared by issuance and confirmation status so both observe the same resend rule. */
export async function readThrottle(
  otpRepository: OtpRepository,
  destination: OtpDestination,
  purpose: OtpPurpose,
  now: Instant
): Promise<OtpThrottleState> {
  const recentCount = await otpRepository.countRecentByIdentifier(
    destination,
    purpose,
    beforeSeconds(now, THROTTLE_WINDOW_SECONDS)
  );
  const lastOtp = await otpRepository.findLatestByIdentifier(
    destination,
    purpose
  );

  return {
    recentCount,
    retryAfterSeconds: getRetryAfter(
      recentCount,
      lastOtp?.createdAt ?? null,
      now
    ),
  };
}
