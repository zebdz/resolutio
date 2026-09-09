import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpChannel, OtpPurpose } from '@/domain/otp/OtpVerification';
import { readThrottle } from './OtpThrottleCalculator';

export interface OtpStatus {
  // A code was sent to the current address, has not expired and can still be
  // entered.
  hasPendingCode: boolean;
  // Seconds until the throttle allows requesting another code; 0 = now.
  retryAfterSeconds: number;
}

export interface OtpStatusQuery {
  userId: string;
  // The address the code must have gone to. One issued to a previous address
  // proves nothing about the current one, so it does not count as pending.
  identifier: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
}

/**
 * What a confirmation page needs in order to render without any state held
 * by the browser: whether there is a code to enter, and when the next one may
 * be requested. Shared by the phone and email confirmation status queries.
 */
export async function readOtpStatus(
  otpRepository: OtpRepository,
  query: OtpStatusQuery
): Promise<OtpStatus> {
  const latest = await otpRepository.findLatestByUserId(
    query.userId,
    query.purpose
  );

  const throttle = await readThrottle(
    otpRepository,
    query.identifier,
    query.channel,
    query.purpose
  );

  return {
    hasPendingCode:
      latest !== null &&
      latest.isPending() &&
      latest.identifier === query.identifier,
    retryAfterSeconds: throttle.retryAfterSeconds,
  };
}

/**
 * Whether a code should go out now on the user's behalf: nothing can still be
 * entered, and the throttle allows it. Login and registration decide with
 * this over the same status the confirm-phone page renders from, so they
 * never disagree with the page's "Send code" button.
 */
export function shouldIssueCode(status: OtpStatus): boolean {
  return !status.hasPendingCode && status.retryAfterSeconds === 0;
}
