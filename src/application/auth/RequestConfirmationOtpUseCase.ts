/** Issues phone-confirmation codes using explicit identity, time and randomness.
 * Throttle decisions and persisted expiry use the same clock reading. */
import { AuthenticationError } from './AuthenticationError';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { OtpCodeGenerator } from './OtpCodeGenerator';
import { OtpVerificationId } from '@/domain/shared/EntityIds';
import { OtpSmsDestination, OtpCount } from '@/domain/otp/OtpValues';
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
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { calculateThrottleDelay, readThrottle } from './OtpThrottleCalculator';

export interface RequestConfirmationOtpInput {
  userId: UserId;
  clientIp: string;
}

export interface RequestConfirmationOtpResult {
  otpId: OtpVerificationId;
  expiresAt: Instant;
  backdoorCode?: string;
  expiresInSeconds: Seconds;
  // Seconds until the throttle allows the next code. The client counts down
  // from this rather than assuming a fixed minute, since the delay escalates.
  retryAfterSeconds: Seconds;
}

interface Dependencies {
  ids: IdGenerator;
  otpCodeGenerator: OtpCodeGenerator;
  clock: Clock;
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel<'sms'>;
  userRepository: UserRepository;
  expiryMinutes?: Minutes;
}

export class RequestConfirmationOtpUseCase {
  private readonly ids: IdGenerator;
  private readonly otpCodeGenerator: OtpCodeGenerator;
  private readonly clock: Clock;
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel<'sms'>;
  private readonly userRepository: UserRepository;
  private readonly expiryMinutes: Minutes;

  constructor(deps: Dependencies) {
    this.ids = deps.ids;
    this.otpCodeGenerator = deps.otpCodeGenerator;
    this.clock = deps.clock;
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.userRepository = deps.userRepository;
    this.expiryMinutes = deps.expiryMinutes ?? Minutes.parse(10);
  }

  async execute(
    input: RequestConfirmationOtpInput
  ): Promise<Result<RequestConfirmationOtpResult, AuthenticationError>> {
    const now = this.clock.now();

    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    try {
      // 1. Find user
      const user = await this.userRepository.findById(input.userId);

      if (!user) {
        return failure(OtpErrors.NOT_FOUND);
      }

      const phone = user.phoneNumber.getValue();

      // 2. Per-phone throttle (not per-IP!)
      const throttle = await readThrottle(
        this.otpRepository,
        OtpSmsDestination.parse({
          identifier: phone,
          channel: this.deliveryChannel.channel,
        }),
        OtpPurposes.PHONE_CONFIRMATION,
        now
      );

      if (throttle.retryAfterSeconds > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      // 3. Generate code, hash it
      const code = this.otpCodeGenerator.generate();
      const hashedCode = this.otpCodeHasher.hash(code.getValue());

      // 4. Save OtpVerification with userId
      const expiresAt = afterSeconds(
        now,
        secondsFromMinutes(this.expiryMinutes)
      );

      const otpVerification = OtpVerification.create(
        {
          ...OtpSmsDestination.parse({
            identifier: phone,
            channel: this.deliveryChannel.channel,
          }),

          purpose: OtpPurposes.PHONE_CONFIRMATION,
          code: hashedCode,
          clientIp: ClientIp.parse(input.clientIp),
          expiresAt,
          userId: user.id,
        },
        { id: this.ids.generate(OtpVerificationId), now }
      );

      const saved = await this.otpRepository.save(otpVerification);

      // 5. Send via delivery channel
      const deliveryResult = await this.deliveryChannel.send(
        OtpSmsDestination.parse({
          channel: this.deliveryChannel.channel,
          identifier: phone,
        }).identifier,
        code.getValue(),
        user.language,
        ClientIp.parse(input.clientIp),
        OtpPurposes.PHONE_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        otpId: saved.id,
        expiresAt,
        backdoorCode: deliveryResult.backdoorCode,
        expiresInSeconds: secondsFromMinutes(this.expiryMinutes),
        // The code just sent joins the window, so the next request waits
        // the following tier.
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
