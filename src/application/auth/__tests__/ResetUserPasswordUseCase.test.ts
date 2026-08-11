import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResetUserPasswordUseCase } from '../ResetUserPasswordUseCase';
import { PasswordGenerator } from '../PasswordGenerator';
import { PasswordHasher } from '../RegisterUserUseCase';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository } from '@/domain/user/SessionRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

describe('ResetUserPasswordUseCase', () => {
  let useCase: ResetUserPasswordUseCase;
  let userRepository: Partial<UserRepository>;
  let sessionRepository: Partial<SessionRepository>;
  let passwordHasher: PasswordHasher;
  let passwordGenerator: PasswordGenerator;
  let user: User;

  beforeEach(() => {
    user = User.reconstitute({
      id: 'user-1',
      firstName: 'Ivan',
      lastName: 'Ivanov',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'old-hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('ivan_ivanov'),
      confirmedAt: new Date('2026-01-02'),
    });

    userRepository = {
      findById: vi.fn().mockResolvedValue(user),
      save: vi.fn().mockImplementation(async (u: User) => u),
    };
    sessionRepository = {
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    passwordHasher = { hash: vi.fn().mockResolvedValue('new-hash') };
    passwordGenerator = {
      generate: vi.fn().mockReturnValue('gen3-Rated-Pass'),
    };

    useCase = new ResetUserPasswordUseCase({
      userRepository: userRepository as UserRepository,
      sessionRepository: sessionRepository as SessionRepository,
      passwordHasher,
      passwordGenerator,
    });
  });

  it('returns the generated plaintext password', async () => {
    const result = await useCase.execute({ userId: 'user-1' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.password).toBe('gen3-Rated-Pass');
    }
  });

  it('stores the hash of the generated password, never the plaintext', async () => {
    await useCase.execute({ userId: 'user-1' });

    expect(passwordHasher.hash).toHaveBeenCalledWith('gen3-Rated-Pass');

    const savedUser = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(savedUser.password).toBe('new-hash');
  });

  it('leaves the rest of the user untouched', async () => {
    await useCase.execute({ userId: 'user-1' });

    const savedUser = (userRepository.save as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as User;
    expect(savedUser.id).toBe('user-1');
    expect(savedUser.firstName).toBe('Ivan');
    expect(savedUser.phoneNumber.getValue()).toBe('+79161234567');
    expect(savedUser.nickname.getValue()).toBe('ivan_ivanov');
    expect(savedUser.confirmedAt).toEqual(new Date('2026-01-02'));
  });

  it('revokes every session the old password had opened', async () => {
    await useCase.execute({ userId: 'user-1' });

    expect(sessionRepository.deleteAllForUser).toHaveBeenCalledWith('user-1');
  });

  it('fails when the user does not exist', async () => {
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    const result = await useCase.execute({ userId: 'missing' });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
    }

    expect(userRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.deleteAllForUser).not.toHaveBeenCalled();
  });
});
