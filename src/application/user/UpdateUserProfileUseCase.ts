import { User } from '@/src/domain/user/User';
import type { UserRepository } from '@/src/domain/user/UserRepository';
import { Result, success, failure } from '@/src/domain/shared/Result';
import type { Language } from '@/src/domain/user/User';

export interface UpdateUserProfileInput {
  userId: string;
  language?: Language;
}

export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<Result<User, Error>> {
    try {
      // Find the user
      const user = await this.userRepository.findById(input.userId);

      if (!user) {
        return failure(new Error(`User with ID ${input.userId} not found`));
      }

      let updatedUser = user;

      // Update language if provided
      if (input.language !== undefined) {
        updatedUser = updatedUser.updateLanguage(input.language);
      }

      // Save the updated user
      const savedUser = await this.userRepository.save(updatedUser);

      return success(savedUser);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
