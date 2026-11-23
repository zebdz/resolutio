/** OTP persistence cannot bypass identity and numeric invariants. */
import { ClientIp } from '../../auth/AuthValues';
import { OtpDestination, OtpCodeHash, OtpAttemptLimit } from '../OtpValues';
import { describe, expect, it } from 'vitest';
import { OtpPurposes, OtpVerification } from '../OtpVerification';
import { OtpVerificationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

describe('OTP identity and values', () => {
  const stored = {
    id: 'otp-1',
    userId: 'user-1',
    identifier: '+79161234567',
    channel: 'sms' as const,
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'stored-hash',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    createdAt: new Date('2026-10-26T10:00:00.000Z'),
    expiresAt: new Date('2026-10-26T10:10:00.000Z'),
    verifiedAt: null,
  };

  it.each([-1, 0.5, NaN, Infinity])(
    'rejects invalid persisted attempt count %s',
    (attempts) => {
      expect(() =>
        OtpVerification.reconstitute({ ...stored, attempts })
      ).toThrow();
    }
  );

  it('creates an identified verification at the supplied instant', () => {
    const creation = {
      id: OtpVerificationId.parse('otp-before-save'),
      now: Instant.parse('2026-10-26T10:00:00.000Z'),
    };
    const otp = OtpVerification.create(
      {
        ...OtpDestination.parse(stored),
        purpose: stored.purpose,
        code: OtpCodeHash.parse(stored.code),
        clientIp: ClientIp.parse(stored.clientIp),
        expiresAt: Instant.fromDate(stored.expiresAt),
        maxAttempts: OtpAttemptLimit.parse(stored.maxAttempts),
        userId: UserId.parse(stored.userId),
      },
      creation
    );

    expect(otp.id).toBe(creation.id);
    expect(otp.createdAt).toBe(creation.now);
  });
});
