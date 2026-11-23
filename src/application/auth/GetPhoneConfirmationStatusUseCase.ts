import { AuthenticationError } from './AuthenticationError';
import { UserId } from '@/domain/shared/EntityIds';

import { Clock } from '@/application/shared/EntityCreation';
import { OtpSmsDestination } from '@/domain/otp/OtpValues';

import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { OtpStatus, readOtpStatus } from './OtpStatus';

export interface GetPhoneConfirmationStatusInput {
  userId: UserId;
}

export type PhoneConfirmationStatus = OtpStatus;

interface Dependencies {
  clock: Clock;
  otpRepository: OtpRepository;
  userRepository: UserRepository;
  deliveryChannel: OtpDeliveryChannel<'sms'>;
}

/**
 * What the confirm-phone page needs in order to render without any state held
 * by the browser: whether there is a code to enter, and when the next one may
 * be requested. The page used to carry the otp id in sessionStorage and,
 * lacking one after a reload or a server-side redirect, requested a fresh code
 * on mount — a request the CAPTCHA-enforced action now rejects.
 */
export class GetPhoneConfirmationStatusUseCase {
  private readonly clock: Clock;
  private readonly otpRepository: OtpRepository;
  private readonly userRepository: UserRepository;
  private readonly deliveryChannel: OtpDeliveryChannel<'sms'>;

  constructor(deps: Dependencies) {
    this.clock = deps.clock;
    this.otpRepository = deps.otpRepository;
    this.userRepository = deps.userRepository;
    this.deliveryChannel = deps.deliveryChannel;
  }

  async execute(
    input: GetPhoneConfirmationStatusInput
  ): Promise<Result<PhoneConfirmationStatus, AuthenticationError>> {
    const now = this.clock.now();
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      return failure(OtpErrors.NOT_FOUND);
    }

    return success(
      await readOtpStatus(
        this.otpRepository,
        {
          destination: OtpSmsDestination.parse({
            identifier: user.phoneNumber.getValue(),
            channel: this.deliveryChannel.channel,
          }),
          userId: user.id,

          purpose: OtpPurposes.PHONE_CONFIRMATION,
        },
        now
      )
    );
  }
}
