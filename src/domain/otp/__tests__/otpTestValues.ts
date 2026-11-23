/** Raw fixture values cross the same validated creation boundary as application inputs. */
import { OtpVerification, RawOtpVerificationProps } from '../OtpVerification';
import {
  OtpAttemptLimit,
  OtpCodeHash,
  OtpDestination,
  OtpPurpose,
} from '../OtpValues';
import { OtpVerificationId, UserId } from '../../shared/EntityIds';
import { ClientIp } from '../../auth/AuthValues';
import { Instant } from '../../shared/Instant';

export function createOtpFixture(
  raw: Omit<
    RawOtpVerificationProps,
    'id' | 'createdAt' | 'attempts' | 'verifiedAt' | 'maxAttempts'
  > & { maxAttempts?: number; id?: string; createdAt?: Date | string }
): OtpVerification {
  const createdAt = raw.createdAt ?? new Date();

  return OtpVerification.create(
    {
      ...OtpDestination.parse(raw),
      purpose: OtpPurpose.parse(raw.purpose),
      code: OtpCodeHash.parse(raw.code),
      clientIp: ClientIp.parse(raw.clientIp),
      userId: UserId.parse(raw.userId),
      expiresAt:
        raw.expiresAt instanceof Date
          ? Instant.fromDate(raw.expiresAt)
          : Instant.parse(raw.expiresAt),
      maxAttempts:
        raw.maxAttempts === undefined
          ? undefined
          : OtpAttemptLimit.parse(raw.maxAttempts),
    },
    {
      id: OtpVerificationId.parse(raw.id ?? 'otp-fixture'),
      now:
        createdAt instanceof Date
          ? Instant.fromDate(createdAt)
          : Instant.parse(createdAt),
    }
  );
}
