import { Seconds } from '@/domain/auth/AuthValues';
import { OtpCount, OtpDestination } from '@/domain/otp/OtpValues';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { authTestDependencies } from '@/application/auth/__tests__/authTestValues';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GetPhoneConfirmationStatusUseCase } from '../GetPhoneConfirmationStatusUseCase';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import {
  OtpVerification,
  OtpChannel,
  OtpPurpose,
  OtpPurposes,
} from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { OtpDeliveryChannel } from '../OtpDeliveryChannel';

class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();

  addOtp(otp: OtpVerification): void {
    this.otps.set(otp.id, otp);
  }

  async save(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  async findLatestByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const { identifier, channel } = destination;

    return this.latest(
      (o) =>
        o.identifier === identifier &&
        o.channel === channel &&
        o.purpose === purpose
    );
  }

  async findLatestByUserId(
    userId: string,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    return this.latest((o) => o.userId === userId && o.purpose === purpose);
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(): Promise<OtpCount> {
    return OtpCount.parse(0);
  }

  async countRecentByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose,
    cutoff: Instant
  ): Promise<OtpCount> {
    const { identifier, channel } = destination;
    const since = Instant.toDate(cutoff);

    return OtpCount.parse(
      Array.from(this.otps.values()).filter(
        (o) =>
          o.identifier === identifier &&
          o.channel === channel &&
          o.purpose === purpose &&
          Instant.toDate(o.createdAt) >= since
      ).length
    );
  }

  async deleteAllForUser(): Promise<OtpCount> {
    return OtpCount.parse(0);
  }

  async deleteExpired(): Promise<void> {}

  private latest(
    match: (o: OtpVerification) => boolean
  ): OtpVerification | null {
    const all = Array.from(this.otps.values()).filter(match);

    if (all.length === 0) {
      return null;
    }

    return all.sort(
      (a, b) =>
        Instant.toDate(b.createdAt).getTime() -
        Instant.toDate(a.createdAt).getTime()
    )[0];
  }
}

const PHONE = '+79161234567';

const user = User.reconstitute({
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  phoneNumber: PhoneNumber.create(PHONE),
  password: 'hashed-pass',
  language: 'ru',
  createdAt: new Date('2024-01-01'),
  nickname: Nickname.create('john_doe'),
});

// Only findById matters here; the rest of the interface is irrelevant.
const userRepository = {
  findById: async (id: string) => (id === user.id ? user : null),
} as unknown as UserRepository;

const smsChannel = {
  channel: 'sms',
  send: async () => ({ success: true }),
} as OtpDeliveryChannel<'sms'>;

function makeOtp(
  overrides: {
    id?: string;
    createdAt?: Date;
    expiresAt?: Date;
    verifiedAt?: Date | null;
    attempts?: number;
    userId?: string;
  } = {}
): OtpVerification {
  const createdAt = overrides.createdAt ?? new Date();

  return OtpVerification.reconstitute({
    id: overrides.id ?? 'otp-1',
    identifier: PHONE,
    channel: 'sms',
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'hashed-123456',
    clientIp: '127.0.0.1',
    attempts: overrides.attempts ?? 0,
    maxAttempts: 5,
    expiresAt:
      overrides.expiresAt ?? new Date(createdAt.getTime() + 10 * 60 * 1000),
    verifiedAt: overrides.verifiedAt ?? null,
    createdAt,
    userId: overrides.userId ?? user.id,
  });
}

describe('GetPhoneConfirmationStatusUseCase', () => {
  let otpRepository: MockOtpRepository;
  let useCase: GetPhoneConfirmationStatusUseCase;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));

    otpRepository = new MockOtpRepository();
    useCase = new GetPhoneConfirmationStatusUseCase({
      ...authTestDependencies(),
      otpRepository,
      userRepository,
      deliveryChannel: smsChannel,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a pending code and the wait before the next one right after a send', async () => {
    otpRepository.addOtp(makeOtp());

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: true,
        retryAfterSeconds: Seconds.parse(60),
      });
    }
  });

  it('reports nothing pending and no wait when no code was ever sent', async () => {
    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: false,
        retryAfterSeconds: Seconds.parse(0),
      });
    }
  });

  it('does not count an expired code as pending', async () => {
    otpRepository.addOtp(
      makeOtp({ createdAt: new Date(Date.now() - 11 * 60 * 1000) })
    );

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success && result.value.hasPendingCode).toBe(false);
  });

  it('does not count a verified code as pending', async () => {
    otpRepository.addOtp(makeOtp({ verifiedAt: new Date() }));

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success && result.value.hasPendingCode).toBe(false);
  });

  it('does not count a code with no attempts left as pending', async () => {
    otpRepository.addOtp(makeOtp({ attempts: 5 }));

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success && result.value.hasPendingCode).toBe(false);
  });

  it('reports no wait once the throttle delay has passed', async () => {
    otpRepository.addOtp(makeOtp({ createdAt: new Date(Date.now() - 61_000) }));

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: true,
        retryAfterSeconds: Seconds.parse(0),
      });
    }
  });

  it('ignores codes issued to other users', async () => {
    otpRepository.addOtp(makeOtp({ userId: UserId.parse('someone-else') }));

    const result = await useCase.execute({ userId: UserId.parse('user-1') });

    expect(result.success && result.value.hasPendingCode).toBe(false);
  });

  it('fails when the user does not exist', async () => {
    const result = await useCase.execute({ userId: UserId.parse('ghost') });

    expect(result.success).toBe(false);
  });
});
