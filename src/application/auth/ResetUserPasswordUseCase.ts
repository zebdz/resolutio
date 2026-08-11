import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository } from '@/domain/user/SessionRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { PasswordHasher } from './RegisterUserUseCase';
import { PasswordGenerator } from './PasswordGenerator';

export interface ResetUserPasswordInput {
  userId: string;
}

export interface ResetUserPasswordResult {
  /**
   * The plaintext password, returned so the superadmin can pass it to the
   * user out of band. Only the hash is stored; this value exists for the
   * lifetime of the response and must never be logged or persisted.
   */
  password: string;
}

interface Dependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordHasher: PasswordHasher;
  passwordGenerator: PasswordGenerator;
}

/**
 * Superadmin-driven password reset: generates a new password for a user,
 * stores its hash, and drops every session the old password had opened.
 * Authorization is the caller's job — this use case assumes it.
 */
export class ResetUserPasswordUseCase {
  private readonly userRepository: UserRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly passwordGenerator: PasswordGenerator;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.sessionRepository = deps.sessionRepository;
    this.passwordHasher = deps.passwordHasher;
    this.passwordGenerator = deps.passwordGenerator;
  }

  async execute(
    input: ResetUserPasswordInput
  ): Promise<Result<ResetUserPasswordResult, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    const password = this.passwordGenerator.generate();
    const hashedPassword = await this.passwordHasher.hash(password);

    await this.userRepository.save(user.changePassword(hashedPassword));

    // Every live session was opened with the old password, so leaving them
    // running would defeat the point of the reset — whoever prompted it
    // (support request, suspected compromise) keeps their access.
    await this.sessionRepository.deleteAllForUser(user.id);

    return success({ password });
  }
}
