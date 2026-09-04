import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestEmailConfirmationOtpUseCase } from '../RequestEmailConfirmationOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import type { OtpDeliveryChannel } from '../OtpDeliveryChannel';
import type { OtpCodeHasher } from '../OtpCodeHasher';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { OtpRepository } from '@/domain/otp/OtpRepository';
import type { UserRepository } from '@/domain/user/UserRepository';

describe('RequestEmailConfirmationOtpUseCase', () => {
  let useCase: RequestEmailConfirmationOtpUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;
  let deliveryChannel: OtpDeliveryChannel;
  let otpCodeHasher: OtpCodeHasher;

  function buildUser(email?: string, confirmed = false) {
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
      findById: vi.fn().mockResolvedValue(buildUser('ivan@mail.ru')),
    };
    otpRepository = {
      countRecentByIdentifier: vi.fn().mockResolvedValue(0),
      findLatestByIdentifier: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (otp: OtpVerification) =>
        OtpVerification.reconstitute({
          id: 'otp-1',
          identifier: otp.identifier,
          channel: otp.channel,
          purpose: otp.purpose,
          code: otp.code,
          clientIp: otp.clientIp,
          attempts: otp.attempts,
          maxAttempts: otp.maxAttempts,
          expiresAt: otp.expiresAt,
          verifiedAt: otp.verifiedAt,
          createdAt: otp.createdAt,
          userId: otp.userId,
        })
      ),
    };
    deliveryChannel = {
      channel: 'email',
      send: vi.fn().mockResolvedValue({ success: true }),
    };
    otpCodeHasher = {
      hash: vi.fn().mockReturnValue('hashed'),
      verify: vi.fn(),
    };

    useCase = new RequestEmailConfirmationOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
      deliveryChannel,
      otpCodeHasher,
      expiryMinutes: 10,
    });
  });

  it('issues an email_confirmation OTP to the address on file', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.identifier).toBe('ivan@mail.ru');
    expect(saved.channel).toBe('email');
    expect(saved.purpose).toBe(OtpPurposes.EMAIL_CONFIRMATION);
    expect(saved.userId).toBe('user-1');
  });

  it('delivers the code to the address with the confirmation purpose', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    expect(deliveryChannel.send).toHaveBeenCalledWith(
      'ivan@mail.ru',
      expect.any(String),
      'ru',
      '127.0.0.1',
      OtpPurposes.EMAIL_CONFIRMATION
    );
  });

  it('stores only the hash of the code', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    const saved = (otpRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as OtpVerification;
    expect(saved.code).toBe('hashed');

    // The plaintext must reach the channel, never the repository.
    const sentCode = (deliveryChannel.send as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(sentCode).not.toBe('hashed');
    expect(sentCode).toMatch(/^\d{6}$/);
  });

  // Authenticated caller: report honestly, there is nothing to hide.
  it('fails when the user has no email on file', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser()
    );

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_NOT_SET);
    }

    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('fails when the email is already confirmed', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      buildUser('ivan@mail.ru', true)
    );

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_ALREADY_CONFIRMED);
    }
  });

  it('fails when the user does not exist', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await useCase.execute({
      userId: 'missing',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
    }
  });

  // Throttling is scoped per purpose so confirming an address cannot consume
  // the user's ability to reset their password minutes later.
  it('throttles on the email + email channel + confirmation purpose', async () => {
    await useCase.execute({ userId: 'user-1', clientIp: '127.0.0.1' });

    expect(otpRepository.countRecentByIdentifier).toHaveBeenCalledWith(
      'ivan@mail.ru',
      'email',
      OtpPurposes.EMAIL_CONFIRMATION,
      expect.any(Number)
    );
  });

  it('fails when throttled', async () => {
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
        purpose: OtpPurposes.EMAIL_CONFIRMATION,
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

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.THROTTLED);
    }

    expect(otpRepository.save).not.toHaveBeenCalled();
  });

  it('fails when delivery fails', async () => {
    (deliveryChannel.send as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.SEND_FAILED);
    }
  });

  it('requires a client IP', async () => {
    const result = await useCase.execute({ userId: 'user-1', clientIp: '' });

    expect(result.success).toBe(false);
    expect(otpRepository.save).not.toHaveBeenCalled();
  });
});
