import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetUserOtpUseCase } from '../ResetUserOtpUseCase';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { UserRepository } from '@/domain/user/UserRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

describe('ResetUserOtpUseCase', () => {
  let useCase: ResetUserOtpUseCase;
  let userRepository: Partial<UserRepository>;
  let otpRepository: Partial<OtpRepository>;

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
    });

    userRepository = { findById: vi.fn().mockResolvedValue(user) };
    otpRepository = { deleteAllForUser: vi.fn().mockResolvedValue(4) };

    useCase = new ResetUserOtpUseCase({
      userRepository: userRepository as UserRepository,
      otpRepository: otpRepository as OtpRepository,
    });
  });

  it('removes every code issued to the user and reports the count', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.deleted).toBe(4);
    }

    expect(otpRepository.deleteAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('fails for an unknown user without touching any codes', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await useCase.execute({ userId: 'ghost' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
    }

    expect(otpRepository.deleteAllForUser).not.toHaveBeenCalled();
  });
});
