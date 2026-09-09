import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmEmailUseCase } from '../ConfirmEmailUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import {
  OtpPurposes,
  OtpVerification,
  type OtpPurpose,
} from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('ConfirmEmailUseCase', () => {
  let useCase: ConfirmEmailUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let otpCodeHasher: OtpCodeHasher;

  function buildOtp(
    overrides: Partial<{
      purpose: OtpPurpose;
      userId: string;
      identifier: string;
      expiresAt: Date;
      attempts: number;
      verifiedAt: Date | null;
    }> = {}
  ) {
    return OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: overrides.identifier ?? 'ivan@mail.ru',
      channel: 'email',
      purpose: overrides.purpose ?? OtpPurposes.EMAIL_CONFIRMATION,
      code: 'hashed',
      clientIp: '127.0.0.1',
      attempts: overrides.attempts ?? 0,
      maxAttempts: 5,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 600_000),
      verifiedAt: overrides.verifiedAt ?? null,
      createdAt: new Date(),
      userId: overrides.userId ?? 'user-1',
    });
  }

  beforeEach(() => {
    const user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    }).changeEmail(EmailAddress.create('ivan@mail.ru'));

    userRepository = {
      findById: vi.fn().mockResolvedValue(user),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    otpRepository = {
      findLatestByUserId: vi.fn().mockResolvedValue(buildOtp()),
      update: vi.fn().mockImplementation(async (o: OtpVerification) => o),
    };
    otpCodeHasher = { hash: vi.fn(), verify: vi.fn().mockReturnValue(true) };

    useCase = new ConfirmEmailUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      otpCodeHasher,
    });
  });

  function run(code = '123456') {
    return useCase.execute({ userId: 'user-1', code });
  }

  it('marks the email confirmed on a valid code', async () => {
    const result = await run();

    expect(result.success).toBe(true);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.hasConfirmedEmail()).toBe(true);
  });

  it('marks the OTP verified so it cannot be reused', async () => {
    await run();

    const updates = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      (updates[updates.length - 1][0] as OtpVerification).isVerified()
    ).toBe(true);
  });

  it('rejects an already-verified code', async () => {
    (
      otpRepository.findLatestByUserId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ verifiedAt: new Date() }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.ALREADY_VERIFIED);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  // The replay guard from spec §4: a reset code must not confirm an address.
  // Ownership and purpose are scoped by the query itself: the browser never
  // names an otp id, so there is nothing to probe.
  it('resolves the latest email-confirmation code issued to the user', async () => {
    await run();

    expect(otpRepository.findLatestByUserId).toHaveBeenCalledWith(
      'user-1',
      OtpPurposes.EMAIL_CONFIRMATION
    );
  });

  // The code proved ownership of the address it was sent to. If the user has
  // since changed their address, it proves nothing about the new one.
  it('rejects a code issued to a different address than the one on file', async () => {
    (
      otpRepository.findLatestByUserId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ identifier: 'old@mail.ru' }));

    const result = await run();

    expect(result.success).toBe(false);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects an expired code', async () => {
    (
      otpRepository.findLatestByUserId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ expiresAt: new Date(Date.now() - 1000) }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }
  });

  it('rejects once attempts are exhausted', async () => {
    (
      otpRepository.findLatestByUserId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ attempts: 5 }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('counts a wrong code as an attempt', async () => {
    (otpCodeHasher.verify as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await run('000000');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }

    const attempted = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(attempted.attempts).toBe(1);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('rejects when the OTP does not exist', async () => {
    (
      otpRepository.findLatestByUserId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }
  });
});
