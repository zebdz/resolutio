/** Applies validated user profile changes and persists privacy audit updates. */
import {
  SharedDomainCodes,
  SharedDomainCode,
} from '@/domain/shared/SharedDomainCodes';
import { UserId } from '@/domain/shared/EntityIds';
import { User } from '@/src/domain/user/User';
import { Nickname } from '@/src/domain/user/Nickname';
import type { UserRepository } from '@/src/domain/user/UserRepository';
import { ProfanityChecker } from '@/src/domain/shared/profanity/ProfanityChecker';
import {
  Address,
  AddressDomainCodes,
  type AddressDomainCode,
  type AddressProps,
} from '@/src/domain/user/Address';
import { Result, success, failure } from '@/src/domain/shared/Result';
import {
  UserDomainCodes,
  UserDomainCode,
} from '@/src/domain/user/UserDomainCodes';
import type { Language } from '@/src/domain/user/User';

export interface UpdateUserProfileInput {
  userId: UserId;
  language?: Language;
  nickname?: string;
  allowFindByName?: boolean;
  allowFindByPhone?: boolean;
  allowFindByAddress?: boolean;
  address?: AddressProps | null;
}

export class UpdateUserProfileUseCase {
  private readonly profanityChecker?: ProfanityChecker;

  constructor(
    private readonly userRepository: UserRepository,
    profanityChecker?: ProfanityChecker
  ) {
    this.profanityChecker = profanityChecker;
  }

  async execute(
    input: UpdateUserProfileInput
  ): Promise<
    Result<User, UserDomainCode | AddressDomainCode | SharedDomainCode>
  > {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    let updatedUser = user;

    // Update language if provided
    if (input.language !== undefined) {
      updatedUser = updatedUser.updateLanguage(input.language);
    }

    // Update nickname if provided and changed
    if (input.nickname !== undefined) {
      let nickname: Nickname;

      try {
        nickname = Nickname.create(input.nickname, this.profanityChecker);
      } catch {
        return failure(UserDomainCodes.NICKNAME_INVALID);
      }

      if (!user.nickname.equals(nickname)) {
        const available =
          await this.userRepository.isNicknameAvailable(nickname);

        if (!available) {
          return failure(UserDomainCodes.NICKNAME_TAKEN);
        }

        updatedUser = updatedUser.updateNickname(nickname);
      }
    }

    // Update address if provided
    if (input.address !== undefined) {
      if (input.address === null) {
        updatedUser = updatedUser.updateAddress(undefined);
        await this.userRepository.deleteAddress(user.id);
      } else {
        try {
          const address = Address.create(input.address, this.profanityChecker);
          updatedUser = updatedUser.updateAddress(address);
        } catch (error) {
          const code =
            error instanceof Error
              ? [
                  ...Object.values(AddressDomainCodes),
                  ...Object.values(SharedDomainCodes),
                ].find((value) => value === error.message)
              : undefined;

          if (code) {
            return failure(code);
          }

          throw error;
        }
      }
    }

    // Update privacy settings only if values actually changed
    const nameChanged =
      input.allowFindByName !== undefined &&
      input.allowFindByName !== user.allowFindByName;
    const phoneChanged =
      input.allowFindByPhone !== undefined &&
      input.allowFindByPhone !== user.allowFindByPhone;
    const addressPrivacyChanged =
      input.allowFindByAddress !== undefined &&
      input.allowFindByAddress !== user.allowFindByAddress;

    if (nameChanged || phoneChanged || addressPrivacyChanged) {
      updatedUser = updatedUser.updatePrivacySettings({
        allowFindByName: input.allowFindByName,
        allowFindByPhone: input.allowFindByPhone,
        allowFindByAddress: input.allowFindByAddress,
      });
      // Transactional: update user + insert audit log
      await this.userRepository.updatePrivacySettings(updatedUser);
    }

    // Save the updated user
    const savedUser = await this.userRepository.save(updatedUser);

    return success(savedUser);
  }
}
