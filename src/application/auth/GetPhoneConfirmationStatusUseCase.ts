import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { OtpStatus, readOtpStatus } from './OtpStatus';

export interface GetPhoneConfirmationStatusInput {
  userId: string;
}

export type PhoneConfirmationStatus = OtpStatus;

interface Dependencies {
  otpRepository: OtpRepository;
  userRepository: UserRepository;
  deliveryChannel: OtpDeliveryChannel;
}

/**
 * What the confirm-phone page needs in order to render without any state held
 * by the browser: whether there is a code to enter, and when the next one may
 * be requested. The page used to carry the otp id in sessionStorage and,
 * lacking one after a reload or a server-side redirect, requested a fresh code
 * on mount — a request the CAPTCHA-enforced action now rejects.
 */
export class GetPhoneConfirmationStatusUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly userRepository: UserRepository;
  private readonly deliveryChannel: OtpDeliveryChannel;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.userRepository = deps.userRepository;
    this.deliveryChannel = deps.deliveryChannel;
  }

  async execute(
    input: GetPhoneConfirmationStatusInput
  ): Promise<Result<PhoneConfirmationStatus, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(OtpErrors.NOT_FOUND);
    }

    return success(
      await readOtpStatus(this.otpRepository, {
        userId: user.id,
        identifier: user.phoneNumber.getValue(),
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.PHONE_CONFIRMATION,
      })
    );
  }
}
