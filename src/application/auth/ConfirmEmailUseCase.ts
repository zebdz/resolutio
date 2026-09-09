import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';

export interface ConfirmEmailInput {
  userId: string;
  code: string;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
}

export class ConfirmEmailUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
  }

  async execute(
    input: ConfirmEmailInput
  ): Promise<Result<{ confirmed: true }, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    if (!user.email) {
      return failure(UserDomainCodes.EMAIL_NOT_SET);
    }

    // The pending code is the latest one issued to this user for this
    // purpose. Ownership and purpose are scoped by the query; the browser
    // never names an otp id, so a reload loses nothing.
    const otp = await this.otpRepository.findLatestByUserId(
      user.id,
      OtpPurposes.EMAIL_CONFIRMATION
    );

    if (!otp) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // The code was issued to the address then on file. If the address has
    // changed since, this code no longer proves anything about the new one.
    if (otp.identifier !== user.email.getValue()) {
      return failure(OtpErrors.NOT_FOUND);
    }

    if (otp.isVerified()) {
      return failure(OtpErrors.ALREADY_VERIFIED);
    }

    if (otp.isExpired()) {
      return failure(OtpErrors.EXPIRED);
    }

    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    if (!this.otpCodeHasher.verify(input.code, otp.code)) {
      return failure(OtpErrors.INVALID);
    }

    await this.otpRepository.update(incremented.markVerified());
    await this.userRepository.save(user.confirmEmail());

    return success({ confirmed: true });
  }
}
