import { User } from '@/src/domain/user/User';
import { Nickname } from '@/src/domain/user/Nickname';
import type { UserRepository } from '@/src/domain/user/UserRepository';
import { Result, success, failure } from '@/src/domain/shared/Result';
import { ValidationError } from '@/src/domain/shared/errors';
import { UserDomainCodes } from '@/src/domain/user/UserDomainCodes';

export interface CompletePrivacySetupInput {
  userId: string;
  nickname?: string;
  allowFindByName: boolean;
  allowFindByPhone: boolean;
}

export class CompletePrivacySetupUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(
    input: CompletePrivacySetupInput
  ): Promise<Result<User, Error>> {
    try {
      const user = await this.userRepository.findById(input.userId);

      if (!user) {
        return failure(new ValidationError(UserDomainCodes.USER_NOT_FOUND));
      }

      let updatedUser = user;

      // Update nickname if provided and changed
      if (input.nickname !== undefined) {
        let nickname: Nickname;

        try {
          nickname = Nickname.create(input.nickname);
        } catch {
          return failure(new ValidationError(UserDomainCodes.NICKNAME_INVALID));
        }

        if (!user.nickname.equals(nickname)) {
          const available = await this.userRepository.isNicknameAvailable(
            nickname.getValue()
          );

          if (!available) {
            return failure(new ValidationError(UserDomainCodes.NICKNAME_TAKEN));
          }

          updatedUser = updatedUser.updateNickname(nickname);
        }
      }

      // Update privacy settings
      updatedUser = updatedUser.updatePrivacySettings({
        allowFindByName: input.allowFindByName,
        allowFindByPhone: input.allowFindByPhone,
      });

      // Mark privacy setup as complete
      updatedUser = updatedUser.completePrivacySetup();

      // Save privacy settings transactionally (user update + audit log)
      await this.userRepository.updatePrivacySettings(updatedUser);

      // Save other changes (nickname, privacySetupCompleted)
      const savedUser = await this.userRepository.save(updatedUser);

      return success(savedUser);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
