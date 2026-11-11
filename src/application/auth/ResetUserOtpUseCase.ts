import { AuthenticationError } from './AuthenticationError';
import { OtpCount } from '@/domain/otp/OtpValues';
import { UserId } from '@/domain/shared/EntityIds';
import { UserRepository } from '@/domain/user/UserRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';

export interface ResetUserOtpInput {
  userId: UserId;
}

export interface ResetUserOtpResult {
  // Codes removed, shown to the superadmin as confirmation that the reset
  // touched something.
  deleted: OtpCount;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
}

/**
 * Superadmin-driven OTP reset: removes every confirmation code issued to a
 * user. The per-address throttle counts those codes, so afterwards the user
 * can request a fresh one right away, or get one on their next login; codes
 * already delivered stop working. Authorization is the caller's job.
 */
export class ResetUserOtpUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
  }

  async execute(
    input: ResetUserOtpInput
  ): Promise<Result<ResetUserOtpResult, AuthenticationError>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    const deleted = await this.otpRepository.deleteAllForUser(user.id);

    return success({ deleted });
  }
}
