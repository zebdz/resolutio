import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpStatus, readOtpStatus } from './OtpStatus';

export interface GetEmailConfirmationStatusInput {
  userId: string;
}

export type EmailConfirmationStatus = OtpStatus;

interface Dependencies {
  otpRepository: OtpRepository;
  userRepository: UserRepository;
  deliveryChannel: OtpDeliveryChannel;
}

/**
 * What the account page needs to render the email confirmation controls
 * without the browser holding an otp id: whether a code for the current
 * address can still be entered, and when the next one may be requested.
 */
export class GetEmailConfirmationStatusUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly userRepository: UserRepository;
  private readonly deliveryChannel: OtpDeliveryChannel;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.userRepository = deps.userRepository;
    this.deliveryChannel = deps.deliveryChannel;
  }

  async execute(
    input: GetEmailConfirmationStatusInput
  ): Promise<Result<EmailConfirmationStatus, string>> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(UserDomainCodes.USER_NOT_FOUND);
    }

    // Nothing to confirm: no address on file, or it already is.
    if (!user.email || user.hasConfirmedEmail()) {
      return success({ hasPendingCode: false, retryAfterSeconds: 0 });
    }

    return success(
      await readOtpStatus(this.otpRepository, {
        userId: user.id,
        identifier: user.email.getValue(),
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.EMAIL_CONFIRMATION,
      })
    );
  }
}
