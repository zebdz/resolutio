/** Issues email-confirmation codes through injected persistence and delivery ports.
 * Identity, time and OTP randomness are explicit application inputs. */
import { AuthenticationError } from './AuthenticationError';
import { UserId } from '@/domain/shared/EntityIds';

import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { OtpCodeGenerator } from './OtpCodeGenerator';
import { OtpVerificationId } from '@/domain/shared/EntityIds';
import { OtpEmailDestination, OtpCount } from '@/domain/otp/OtpValues';
import {
  ClientIp,
  Minutes,
  Seconds,
  afterSeconds,
  secondsFromMinutes,
} from '@/domain/auth/AuthValues';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';

import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { calculateThrottleDelay, readThrottle } from './OtpThrottleCalculator';

export interface RequestEmailConfirmationOtpInput {
  userId: UserId;
  clientIp: string;
}

export interface RequestEmailConfirmationOtpResult {
  // Seconds until the throttle allows the next code; the account page counts
  // down from this. Nothing else is needed: confirming resolves the code
  // server-side from the user.
  retryAfterSeconds: Seconds;
}

interface Dependencies {
  ids: IdGenerator;
  otpCodeGenerator: OtpCodeGenerator;
  clock: Clock;
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  deliveryChannel: OtpDeliveryChannel<'email'>;
  otpCodeHasher: OtpCodeHasher;
  expiryMinutes?: Minutes;
}

/**
 * Issues a confirmation code to the address a signed-in user has on file.
 * The caller is authenticated, so failures name their real cause — unlike the
 * password-reset flow, there is nothing here to hide from them.
 */
export class RequestEmailConfirmationOtpUseCase {
  private readonly ids: IdGenerator;
  private readonly otpCodeGenerator: OtpCodeGenerator;
  private readonly clock: Clock;
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly deliveryChannel: OtpDeliveryChannel<'email'>;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly expiryMinutes: Minutes;

  constructor(deps: Dependencies) {
    this.ids = deps.ids;
    this.otpCodeGenerator = deps.otpCodeGenerator;
    this.clock = deps.clock;
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.expiryMinutes = deps.expiryMinutes ?? Minutes.parse(10);
  }

  async execute(
    input: RequestEmailConfirmationOtpInput
  ): Promise<Result<RequestEmailConfirmationOtpResult, AuthenticationError>> {
    const now = this.clock.now();

    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    try {
      const user = await this.userRepository.findById(input.userId);

      if (!user) {
        return failure(UserDomainCodes.USER_NOT_FOUND);
      }

      if (!user.email) {
        return failure(UserDomainCodes.EMAIL_NOT_SET);
      }

      if (user.hasConfirmedEmail()) {
        return failure(UserDomainCodes.EMAIL_ALREADY_CONFIRMED);
      }

      const address = user.email.getValue();

      const throttle = await readThrottle(
        this.otpRepository,
        OtpEmailDestination.parse({
          identifier: address,
          channel: this.deliveryChannel.channel,
        }),
        OtpPurposes.EMAIL_CONFIRMATION,
        now
      );

      if (throttle.retryAfterSeconds > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      const code = this.otpCodeGenerator.generate();
      const expiresAt = afterSeconds(
        now,
        secondsFromMinutes(this.expiryMinutes)
      );

      await this.otpRepository.save(
        OtpVerification.create(
          {
            ...OtpEmailDestination.parse({
              identifier: address,
              channel: this.deliveryChannel.channel,
            }),

            purpose: OtpPurposes.EMAIL_CONFIRMATION,
            code: this.otpCodeHasher.hash(code.getValue()),
            clientIp: ClientIp.parse(input.clientIp),
            expiresAt,
            userId: user.id,
          },
          { id: this.ids.generate(OtpVerificationId), now }
        )
      );

      const deliveryResult = await this.deliveryChannel.send(
        OtpEmailDestination.parse({
          channel: this.deliveryChannel.channel,
          identifier: address,
        }).identifier,
        code.getValue(),
        user.language,
        ClientIp.parse(input.clientIp),
        OtpPurposes.EMAIL_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        retryAfterSeconds: calculateThrottleDelay(
          OtpCount.parse(throttle.recentCount + 1)
        ),
      });
    } catch (error) {
      // Unexpected adapter failures use the stable, localized delivery code.
      return failure(OtpErrors.SEND_FAILED);
    }
  }
}
