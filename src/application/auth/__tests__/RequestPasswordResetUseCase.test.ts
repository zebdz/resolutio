import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestPasswordResetUseCase } from '../RequestPasswordResetUseCase';
import { AuthErrors } from '../AuthErrors';
import type { OtpDeliveryChannel } from '../OtpDeliveryChannel';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('RequestPasswordResetUseCase', () => {
  let useCase: RequestPasswordResetUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let deliveryChannel: OtpDeliveryChannel;
  let otpCodeHasher: OtpCodeHasher;

  function buildUser(email?: string, confirmed = true) {
    let user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
    });

    if (email) {
      user = user.changeEmail(EmailAddress.create(email));

      if (confirmed) {
        user = user.confirmEmail();
      }
    }

    return user;
  }

  beforeEach(() => {
    userRepository = {
      findByEmail: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
      findByPhoneNumber: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
    };
    otpRepository = {
      countRecentByIdentifier: vi.fn().mockResolvedValue(0),
      findLatestByIdentifier: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (otp: OtpVerification) => otp),
    };
    deliveryChannel = {
      channel: 'email',
      send: vi.fn().mockResolvedValue({ success: true }),
    };
    otpCodeHasher = {
      hash: vi.fn().mockReturnValue('hashed'),
      verify: vi.fn(),
    };

    useCase = new RequestPasswordResetUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      deliveryChannel,
      otpCodeHasher,
      expiryMinutes: 10,
    });
  });

  function run(identifier = 'ivan@mail.ru', clientIp = '127.0.0.1') {
    return useCase.execute({ identifier, clientIp });
  }

  it('issues a password_reset OTP to the confirmed address', async () => {
    const result = await run();

    expect(result.success).toBe(true);

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
    expect(saved.purpose).toBe(OtpPurposes.PASSWORD_RESET);
    expect(saved.userId).toBe('user-1');
    expect(saved.code).toBe('hashed');
  });

  it('resolves a phone identifier to the same address', async () => {
    await run('+79161234567');

    expect(userRepository.findByPhoneNumber).toHaveBeenCalled();

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
  });

  it('delivers with the reset purpose so the right template is used', async () => {
    await run();

    expect(deliveryChannel.send).toHaveBeenCalledWith(
      'ivan@mail.ru',
      expect.any(String),
      'ru',
      '127.0.0.1',
      OtpPurposes.PASSWORD_RESET
    );
  });

  // The no-enumeration cases. The second assertion in each is the one that
  // matters: nothing is written, so there is no timing or state difference to
  // distinguish a real account from an absent one.
  it('reports success and writes nothing for an unknown account', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await run('nobody@mail.ru');

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
    expect(deliveryChannel.send).not.toHaveBeenCalled();
  });

  it('reports success and writes nothing when the account has no email', async () => {
    (
      userRepository.findByPhoneNumber as ReturnType<typeof vi.fn>
    ).mockResolvedValue(buildUser());

    const result = await run('+79161234567');

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('reports success and writes nothing when the email is unconfirmed', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', false)
    );

    const result = await run();

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('reports success even when delivery fails', async () => {
    (deliveryChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await run();

    expect(result.success).toBe(true);
  });

  it('reports success when throttled, so the throttle is not an oracle either', async () => {
    (
      otpRepository.countRecentByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(99);
    (
      otpRepository.findLatestByIdentifier as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      OtpVerification.reconstitute({
        id: 'otp-0',
        identifier: 'ivan@mail.ru',
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
    );

    const result = await run();

    expect(result.success).toBe(true);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  // An unexpected fault must not distinguish itself from the happy path.
  it('reports success even when the repository throws', async () => {
    (userRepository.findByEmail as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('connection lost')
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await run();

    expect(result.success).toBe(true);
    logged.mockRestore();
  });

  it('throttles on the reset purpose, not the confirmation one', async () => {
    await run();

    expect(otpRepository.countRecentByIdentifier).toHaveBeenCalledWith(
      'ivan@mail.ru',
      'email',
      OtpPurposes.PASSWORD_RESET,
      expect.any(Number)
    );
  });

  // Syntactic, not existential — safe to report.
  it('rejects an identifier that is neither a phone nor an email', async () => {
    const result = await run('ivan');

    expect(result.success).toBe(false);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('requires a client IP', async () => {
    const result = await run('ivan@mail.ru', '');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.MISSING_IP);
    }
  });
});
