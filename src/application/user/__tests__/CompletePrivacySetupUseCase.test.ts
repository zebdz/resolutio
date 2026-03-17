import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompletePrivacySetupUseCase } from '../CompletePrivacySetupUseCase';
import { User } from '@/src/domain/user/User';
import { PhoneNumber } from '@/src/domain/user/PhoneNumber';
import { Nickname } from '@/src/domain/user/Nickname';
import { UserDomainCodes } from '@/src/domain/user/UserDomainCodes';
import type { UserRepository } from '@/src/domain/user/UserRepository';

describe('CompletePrivacySetupUseCase', () => {
  let userRepository: UserRepository;
  let useCase: CompletePrivacySetupUseCase;

  const existingUser = User.reconstitute({
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword',
    language: 'en',
    createdAt: new Date('2024-01-01'),
    nickname: Nickname.create('user_abc12345'),
    privacySetupCompleted: false,
  });

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByIds: vi.fn(),
      findByPhoneNumber: vi.fn(),
      findByNickname: vi.fn(),
      isNicknameAvailable: vi.fn(),
      save: vi.fn(),
      updatePrivacySettings: vi.fn(),
      exists: vi.fn(),
      searchUsers: vi.fn(),
      searchUserByPhone: vi.fn(),
      isSuperAdmin: vi.fn(),
      isUserBlocked: vi.fn().mockResolvedValue(false),
      blockUser: vi.fn(),
      unblockUser: vi.fn(),
      confirmUser: vi.fn(),
      getBlockStatus: vi.fn().mockResolvedValue(null),
    };
    useCase = new CompletePrivacySetupUseCase(userRepository);
  });

  it('should complete privacy setup with all fields', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
    vi.mocked(userRepository.isNicknameAvailable).mockResolvedValue(true);
    vi.mocked(userRepository.save).mockImplementation((user) =>
      Promise.resolve(user)
    );
    vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();

    const result = await useCase.execute({
      userId: 'user-123',
      nickname: 'my_nickname',
      allowFindByName: true,
      allowFindByPhone: false,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.nickname.getValue()).toBe('my_nickname');
      expect(result.value.allowFindByName).toBe(true);
      expect(result.value.allowFindByPhone).toBe(false);
      expect(result.value.privacySetupCompleted).toBe(true);
    }

    expect(userRepository.updatePrivacySettings).toHaveBeenCalled();
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('should fail when user not found', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    const result = await useCase.execute({
      userId: 'nonexistent',
      nickname: 'my_nickname',
      allowFindByName: true,
      allowFindByPhone: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
    }
  });

  it('should fail when nickname is taken by another user', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
    vi.mocked(userRepository.isNicknameAvailable).mockResolvedValue(false);

    const result = await useCase.execute({
      userId: 'user-123',
      nickname: 'taken_name',
      allowFindByName: true,
      allowFindByPhone: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.NICKNAME_TAKEN);
    }
  });

  it('should skip nickname uniqueness check when nickname unchanged', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
    vi.mocked(userRepository.save).mockImplementation((user) =>
      Promise.resolve(user)
    );
    vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();

    const result = await useCase.execute({
      userId: 'user-123',
      nickname: 'user_abc12345', // same as existing
      allowFindByName: false,
      allowFindByPhone: false,
    });

    expect(result.success).toBe(true);
    expect(userRepository.isNicknameAvailable).not.toHaveBeenCalled();
  });

  it('should fail when nickname is invalid', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

    const result = await useCase.execute({
      userId: 'user-123',
      nickname: 'ab', // too short
      allowFindByName: true,
      allowFindByPhone: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.NICKNAME_INVALID);
    }
  });

  it('should keep existing nickname when not provided', async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
    vi.mocked(userRepository.save).mockImplementation((user) =>
      Promise.resolve(user)
    );
    vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();

    const result = await useCase.execute({
      userId: 'user-123',
      allowFindByName: true,
      allowFindByPhone: true,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.nickname.getValue()).toBe('user_abc12345');
      expect(result.value.privacySetupCompleted).toBe(true);
    }
  });
});
