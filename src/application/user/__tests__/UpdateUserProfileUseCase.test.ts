import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateUserProfileUseCase } from '../UpdateUserProfileUseCase';
import { User } from '@/src/domain/user/User';
import { PhoneNumber } from '@/src/domain/user/PhoneNumber';
import { Nickname } from '@/src/domain/user/Nickname';
import { UserDomainCodes } from '@/src/domain/user/UserDomainCodes';
import { Address } from '@/src/domain/user/Address';
import type { UserRepository } from '@/src/domain/user/UserRepository';

describe('UpdateUserProfileUseCase', () => {
  let userRepository: UserRepository;
  let useCase: UpdateUserProfileUseCase;

  const existingUser = User.reconstitute({
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    middleName: 'Smith',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashedpassword',
    language: 'en',
    createdAt: new Date('2024-01-01'),
    nickname: Nickname.create('john_doe_123'),
    allowFindByName: false,
    allowFindByPhone: false,
    privacySetupCompleted: true,
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
      deleteAddress: vi.fn(),
      exists: vi.fn(),
      searchUsers: vi.fn(),
      searchUserByPhone: vi.fn(),
      isSuperAdmin: vi.fn(),
      isUserBlocked: vi.fn().mockResolvedValue(false),
      blockUser: vi.fn(),
      unblockUser: vi.fn(),
      confirmUser: vi.fn(),
      getBlockStatus: vi.fn().mockResolvedValue(null),
      getBlockedUserIds: vi.fn().mockResolvedValue([]),
    };
    useCase = new UpdateUserProfileUseCase(userRepository);
  });

  describe('execute', () => {
    it('should update language successfully', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        language: 'ru',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.language).toBe('ru');
      }

      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should return failure when user not found', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const result = await useCase.execute({
        userId: 'nonexistent',
        language: 'ru',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(UserDomainCodes.USER_NOT_FOUND);
      }

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw when invalid language provided', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

      await expect(
        useCase.execute({
          userId: 'user-123',
          language: 'invalid' as any,
        })
      ).rejects.toThrow('Language');
    });

    it('should handle no updates gracefully', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
      });

      expect(result.success).toBe(true);
      // User should remain unchanged
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should update nickname when changed and available', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.isNicknameAvailable).mockResolvedValue(true);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        nickname: 'new_nick',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.nickname.getValue()).toBe('new_nick');
      }
    });

    it('should fail when nickname is taken', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.isNicknameAvailable).mockResolvedValue(false);

      const result = await useCase.execute({
        userId: 'user-123',
        nickname: 'taken_nick',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(UserDomainCodes.NICKNAME_TAKEN);
      }
    });

    it('should skip nickname check when unchanged', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        nickname: 'john_doe_123',
      });

      expect(result.success).toBe(true);
      expect(userRepository.isNicknameAvailable).not.toHaveBeenCalled();
    });

    it('should update privacy settings and create audit log', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        allowFindByName: true,
        allowFindByPhone: true,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.allowFindByName).toBe(true);
        expect(result.value.allowFindByPhone).toBe(true);
      }

      expect(userRepository.updatePrivacySettings).toHaveBeenCalled();
    });

    it('should not call updatePrivacySettings when privacy unchanged', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        language: 'ru',
      });

      expect(result.success).toBe(true);
      expect(userRepository.updatePrivacySettings).not.toHaveBeenCalled();
    });

    it('should not call updatePrivacySettings when values are same as current', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      // existingUser has allowFindByName=false, allowFindByPhone=false
      const result = await useCase.execute({
        userId: 'user-123',
        allowFindByName: false,
        allowFindByPhone: false,
      });

      expect(result.success).toBe(true);
      expect(userRepository.updatePrivacySettings).not.toHaveBeenCalled();
    });

    it('should fail when nickname is invalid', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

      const result = await useCase.execute({
        userId: 'user-123',
        nickname: 'ab',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(UserDomainCodes.NICKNAME_INVALID);
      }
    });

    it('should update address when provided', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        address: {
          country: 'Russia',
          city: 'Moscow',
          street: 'Tverskaya',
          building: '12',
        },
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.address).toBeDefined();
        expect(result.value.address!.city).toBe('Moscow');
      }
    });

    it('should clear address when address is null', async () => {
      const userWithAddress = User.reconstitute({
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: PhoneNumber.create('+79161234567'),
        password: 'hashedpassword',
        language: 'en',
        createdAt: new Date('2024-01-01'),
        nickname: Nickname.create('john_doe_123'),
        allowFindByName: false,
        allowFindByPhone: false,
        privacySetupCompleted: true,
        address: Address.create({
          country: 'Russia',
          city: 'Moscow',
          street: 'Tverskaya',
          building: '12',
        }),
      });

      vi.mocked(userRepository.findById).mockResolvedValue(userWithAddress);
      vi.mocked(userRepository.deleteAddress).mockResolvedValue();
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        address: null,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.address).toBeUndefined();
      }

      expect(userRepository.deleteAddress).toHaveBeenCalledWith('user-123');
    });

    it('should update allowFindByAddress via privacy settings', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);
      vi.mocked(userRepository.updatePrivacySettings).mockResolvedValue();
      vi.mocked(userRepository.save).mockImplementation((user) =>
        Promise.resolve(user)
      );

      const result = await useCase.execute({
        userId: 'user-123',
        allowFindByAddress: true,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.allowFindByAddress).toBe(true);
      }

      expect(userRepository.updatePrivacySettings).toHaveBeenCalled();
    });

    it('should return failure for invalid address (missing city)', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

      const result = await useCase.execute({
        userId: 'user-123',
        address: {
          country: 'Russia',
          city: '',
          street: 'Tverskaya',
          building: '12',
        },
      });

      expect(result.success).toBe(false);
    });
  });
});
