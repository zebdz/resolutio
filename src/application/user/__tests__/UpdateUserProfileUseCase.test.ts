import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateUserProfileUseCase } from '../UpdateUserProfileUseCase';
import { User } from '@/src/domain/user/User';
import { PhoneNumber } from '@/src/domain/user/PhoneNumber';
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
  });

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByPhoneNumber: vi.fn(),
      save: vi.fn(),
      exists: vi.fn(),
      searchUsers: vi.fn(),
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
        expect(result.error.message).toContain('not found');
      }
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should return failure when invalid language provided', async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(existingUser);

      const result = await useCase.execute({
        userId: 'user-123',
        language: 'invalid' as any,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Language');
      }
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
  });
});
