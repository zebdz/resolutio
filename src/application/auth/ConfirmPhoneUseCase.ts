import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';

export interface ConfirmPhoneInput {
  userId: string;
  code: string;
}

interface Dependencies {
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
  userRepository: UserRepository;
}

export class ConfirmPhoneUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly userRepository: UserRepository;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.userRepository = deps.userRepository;
  }

  async execute(
    input: ConfirmPhoneInput
  ): Promise<Result<{ confirmed: true }, string>> {
    // 1. Find user
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // 2. Already confirmed?
    if (user.isConfirmed()) {
      return failure(AuthErrors.ACCOUNT_NOT_CONFIRMED);
    }

    // 3. Resolve the code server-side: the latest one minted for this user to
    // confirm a phone. The client used to send an otp id, but that id only
    // ever lived in browser state, so a reload or a server-side redirect lost
    // it. Looking up by user and purpose also settles, at the query itself,
    // that the OTP belongs to the user being confirmed and that a code minted
    // to confirm an email address or reset a password is not spendable here.
    const otp = await this.otpRepository.findLatestByUserId(
      user.id,
      OtpPurposes.PHONE_CONFIRMATION
    );

    if (!otp) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // 4. Check not expired
    if (otp.isExpired()) {
      return failure(OtpErrors.EXPIRED);
    }

    // 5. Check not max attempts
    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    // 6. Increment attempts, save
    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    // 7. Verify code hash
    const codeValid = this.otpCodeHasher.verify(input.code, otp.code);

    if (!codeValid) {
      return failure(OtpErrors.INVALID);
    }

    // 8. Mark OTP verified
    const verified = incremented.markVerified();
    await this.otpRepository.update(verified);

    // 9. Confirm user
    await this.userRepository.confirmUser(input.userId);

    return success({ confirmed: true });
  }
}
