import { OtpRepository } from '@/domain/otp/OtpRepository';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';

export interface VerifyOtpInput {
  otpId: string;
  code: string;
}

interface Dependencies {
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
}

export class VerifyOtpUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
  }

  async execute(
    input: VerifyOtpInput
  ): Promise<Result<{ verified: true }, string>> {
    // 1. Find by otpId
    const otp = await this.otpRepository.findById(input.otpId);

    if (!otp) {
      return failure(OtpErrors.NOT_FOUND);
    }

    // 2. Check not expired
    if (otp.isExpired()) {
      return failure(OtpErrors.EXPIRED);
    }

    // 3. Check not already verified
    if (otp.isVerified()) {
      return failure(OtpErrors.ALREADY_VERIFIED);
    }

    // 4. Check not max attempts
    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    // 5. Increment attempts, save
    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    // 6. Verify code hash
    const codeValid = this.otpCodeHasher.verify(input.code, otp.code);

    if (!codeValid) {
      return failure(OtpErrors.INVALID);
    }

    // 7. Match → mark verified
    const verified = incremented.markVerified();
    await this.otpRepository.update(verified);

    return success({ verified: true });
  }
}
