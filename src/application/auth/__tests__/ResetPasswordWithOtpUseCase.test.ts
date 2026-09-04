import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetPasswordWithOtpUseCase } from '../ResetPasswordWithOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import type { PasswordHasher } from '../RegisterUserUseCase';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import {
  OtpPurposes,
  OtpVerification,
  type OtpPurpose,
} from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';
import type { SessionRepository } from '@/domain/user/SessionRepository';

describe('ResetPasswordWithOtpUseCase', () => {
  let useCase: ResetPasswordWithOtpUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let sessionRepository: Partial<SessionRepository>;
  let otpCodeHasher: OtpCodeHasher;
  let passwordHasher: PasswordHasher;

  const GOOD_PASSWORD = 'Korova-Zabor-71';

  function buildUser() {
    return User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'old-hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    })
      .changeEmail(EmailAddress.create('ivan@mail.ru'))
      .confirmEmail();
  }

  function buildOtp(
    overrides: Partial<{
      purpose: OtpPurpose;
      expiresAt: Date;
      attempts: number;
      verifiedAt: Date | null;
      userId: string;
    }> = {}
  ) {
    return OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: 'ivan@mail.ru',
      channel: 'email',
      purpose: overrides.purpose ?? OtpPurposes.PASSWORD_RESET,
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
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser()),
      findByPhoneNumber: vi.fn().mockResolvedValue(buildUser()),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    otpRepository = {
      findLatestByIdentifier: vi.fn().mockResolvedValue(buildOtp()),
      update: vi.fn().mockImplementation(async (o: OtpVerification) => o),
    };
    sessionRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    otpCodeHasher = { hash: vi.fn(), verify: vi.fn().mockReturnValue(true) };
    passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash') };

    useCase = new ResetPasswordWithOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      sessionRepository: sessionRepository as SessionRepository,
      otpCodeHasher,
      passwordHasher,
    });
  });

  function run(
    overrides: Partial<{
      identifier: string;
      code: string;
      newPassword: string;
    }> = {}
  ) {
    return useCase.execute({
      identifier: overrides.identifier ?? 'ivan@mail.ru',
      code: overrides.code ?? '123456',
      newPassword: overrides.newPassword ?? GOOD_PASSWORD,
    });
  }

  it('stores the hash of the new password, never the plaintext', async () => {
    const result = await run();

    expect(result.success).toBe(true);
    expect(passwordHasher.hash).toHaveBeenCalledWith(GOOD_PASSWORD);

    const saved = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(saved.password).toBe('new-hash');
  });

  // Same reasoning as the superadmin reset: a reset prompted by suspected
  // compromise is pointless if the compromiser's session survives it.
  it('revokes every existing session', async () => {
    await run();

    expect(sessionRepository.deleteAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('marks the code verified so it cannot be spent twice', async () => {
    await run();

    const updates = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      (updates[updates.length - 1][0] as OtpVerification).isVerified()
    ).toBe(true);
  });

  it('accepts a phone identifier and looks up the same reset code', async () => {
    await run({ identifier: '+79161234567' });

    expect(otpRepository.findLatestByIdentifier).toHaveBeenCalledWith(
      'ivan@mail.ru',
      'email',
      OtpPurposes.PASSWORD_RESET
    );
  });

  // The cross-purpose replay from spec §4 — the reason the purpose column
  // exists at all.
  it('refuses a code minted to confirm an email address', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ purpose: OtpPurposes.EMAIL_CONFIRMATION }));

    const result = await run();

    expect(result.success).toBe(false);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });

  it('refuses a code bound to a different user', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ userId: 'someone-else' }));

    const result = await run();

    expect(result.success).toBe(false);
    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('refuses an expired code', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ expiresAt: new Date(Date.now() - 1000) }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  it('refuses a code that was already spent', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ verifiedAt: new Date() }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.ALREADY_VERIFIED);
    }
  });

  it('refuses once attempts are exhausted', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildOtp({ attempts: 5 }));

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('counts a wrong code as an attempt and changes nothing', async () => {
    (otpCodeHasher.verify as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await run({ code: '000000' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }

    const attempted = (otpRepository.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(attempted.attempts).toBe(1);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });

  it('refuses a password shorter than the minimum', async () => {
    const result = await run({ newPassword: 'short' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.PASSWORD_TOO_SHORT);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
  });

  // The user is resolved before validation, so this checks the real name and
  // phone rather than anything the client asserted.
  it('refuses a password containing the user’s own phone number', async () => {
    const result = await run({ newPassword: '79161234567' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO);
    }
  });

  // Password rules are checked only after the code proves ownership, or the
  // validation messages would themselves reveal which accounts exist.
  it('does not reveal password rules before the code is verified', async () => {
    (otpCodeHasher.verify as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = await run({ code: '000000', newPassword: 'short' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });

  it('reports the same not-found for an unknown account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await run({ identifier: 'nobody@mail.ru' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });

  it('reports the same not-found when no reset code was ever issued', async () => {
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const result = await run();

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });

  it('reports the same not-found for a syntactically bad identifier', async () => {
    const result = await run({ identifier: 'ivan' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });
});

describe('ResetPasswordWithOtpUseCase — password vs. the account email', () => {
  // Wired in after the feature shipped: the user's own address is personal
  // info just as much as their name and phone.
  it('refuses a new password equal to the account email', async () => {
    const userRepository: Partial<UserRepository> = {
      findByEmail: vi.fn().mockResolvedValue(
        User.reconstitute({
          id: 'user-1',
          firstName: 'Ivan',
          lastName: 'Ivanov',
          phoneNumber: PhoneNumber.create('+79161234567'),
          password: 'old-hash',
          language: 'ru',
          createdAt: new Date('2026-01-01'),
          nickname: Nickname.create('ivan_ivanov'),
        })
          .changeEmail(EmailAddress.create('ivan.petrov@mail.ru'))
          .confirmEmail()
      ),
      save: vi.fn(),
    };
    const otpRepository: Partial<OtpRepository> = {
      findLatestByIdentifier: vi.fn().mockResolvedValue(
        OtpVerification.reconstitute({
          id: 'otp-1',
          identifier: 'ivan.petrov@mail.ru',
          channel: 'email',
          purpose: OtpPurposes.PASSWORD_RESET,
          code: 'hashed',
          clientIp: '127.0.0.1',
          attempts: 0,
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 600_000),
          verifiedAt: null,
          createdAt: new Date(),
          userId: 'user-1',
        })
      ),
      update: vi.fn().mockImplementation(async (o: OtpVerification) => o),
    };
    const sessionRepository: Partial<SessionRepository> = {
      deleteAllForUser: vi.fn(),
    };

    const useCase = new ResetPasswordWithOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      sessionRepository: sessionRepository as SessionRepository,
      otpCodeHasher: { hash: vi.fn(), verify: vi.fn().mockReturnValue(true) },
      passwordHasher: { hash: vi.fn().mockResolvedValue('new-hash') },
    });

    for (const candidate of ['ivan.petrov@mail.ru', 'ivan.petrov']) {
      const result = await useCase.execute({
        identifier: 'ivan.petrov@mail.ru',
        code: '123456',
        newPassword: candidate,
      });

      expect(result.success, `${candidate} should be rejected`).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(
          UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO
        );
      }
    }

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });
});
