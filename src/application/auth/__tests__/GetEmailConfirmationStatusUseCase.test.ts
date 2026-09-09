import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GetEmailConfirmationStatusUseCase } from '../GetEmailConfirmationStatusUseCase';
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
import { EmailAddress } from '@/domain/user/EmailAddress';
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
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
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

  async countRecentByClientIp(): Promise<number> {
    return 0;
  }

  async countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    sinceHours: number
  ): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return Array.from(this.otps.values()).filter(
      (o) =>
        o.identifier === identifier &&
        o.channel === channel &&
        o.purpose === purpose &&
        o.createdAt >= since
    ).length;
  }

  async deleteAllForUser(): Promise<number> {
    return 0;
  }

  async deleteExpired(): Promise<void> {}

  private latest(
    match: (o: OtpVerification) => boolean
  ): OtpVerification | null {
    const matches = Array.from(this.otps.values())
      .filter(match)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return matches[0] ?? null;
  }
}

function buildUser(email?: string): User {
  const user = User.reconstitute({
    id: 'user-1',
    firstName: 'Ivan',
    lastName: 'Ivanov',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hash',
    language: 'ru',
    createdAt: new Date('2026-01-01'),
    nickname: Nickname.create('ivan_ivanov'),
  });

  return email ? user.changeEmail(EmailAddress.create(email)) : user;
}

function makeOtp(
  overrides: Partial<{
    id: string;
    identifier: string;
    createdAt: Date;
    expiresAt: Date;
    verifiedAt: Date | null;
    attempts: number;
  }> = {}
): OtpVerification {
  const createdAt = overrides.createdAt ?? new Date();

  return OtpVerification.reconstitute({
    id: overrides.id ?? 'otp-1',
    identifier: overrides.identifier ?? 'ivan@mail.ru',
    channel: 'email',
    purpose: OtpPurposes.EMAIL_CONFIRMATION,
    code: 'hashed',
    clientIp: '127.0.0.1',
    attempts: overrides.attempts ?? 0,
    maxAttempts: 5,
    expiresAt: overrides.expiresAt ?? new Date(createdAt.getTime() + 600_000),
    verifiedAt: overrides.verifiedAt ?? null,
    createdAt,
    userId: 'user-1',
  });
}

describe('GetEmailConfirmationStatusUseCase', () => {
  let otpRepository: MockOtpRepository;
  let userRepository: { findById: ReturnType<typeof vi.fn> };
  let useCase: GetEmailConfirmationStatusUseCase;
  const emailChannel = {
    channel: 'email',
    send: vi.fn(),
  } as unknown as OtpDeliveryChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    otpRepository = new MockOtpRepository();
    userRepository = {
      findById: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
    };
    useCase = new GetEmailConfirmationStatusUseCase({
      otpRepository,
      userRepository: userRepository as unknown as UserRepository,
      deliveryChannel: emailChannel,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a fresh code as pending, with the first tier to wait', async () => {
    otpRepository.addOtp(makeOtp());

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: true,
        retryAfterSeconds: 60,
      });
    }
  });

  it('reports nothing pending when no code was issued', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: false,
        retryAfterSeconds: 0,
      });
    }
  });

  // The code proved ownership of the address it went to, not of the one
  // entered since; the throttle is keyed by the current address too.
  it('does not count a code issued to a previous address', async () => {
    otpRepository.addOtp(makeOtp({ identifier: 'old@mail.ru' }));

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: false,
        retryAfterSeconds: 0,
      });
    }
  });

  it('reports nothing to confirm without an address on file', async () => {
    userRepository.findById.mockResolvedValue(buildUser());
    otpRepository.addOtp(makeOtp());

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: false,
        retryAfterSeconds: 0,
      });
    }
  });

  it('reports nothing to confirm once the address is confirmed', async () => {
    userRepository.findById.mockResolvedValue(
      buildUser('ivan@mail.ru').confirmEmail()
    );
    otpRepository.addOtp(makeOtp());

    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual({
        hasPendingCode: false,
        retryAfterSeconds: 0,
      });
    }
  });

  it('fails for an unknown user', async () => {
    userRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'ghost' });

    expect(result.success).toBe(false);
  });
});
