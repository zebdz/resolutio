import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { UserRepository } from '@/domain/user/UserRepository';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { calculateThrottleDelay, readThrottle } from './OtpThrottleCalculator';

export interface RequestConfirmationOtpInput {
  userId: string;
  clientIp: string;
}

export interface RequestConfirmationOtpResult {
  otpId: string;
  expiresAt: Date;
  backdoorCode?: string;
  expiresInSeconds: number;
  // Seconds until the throttle allows the next code. The client counts down
  // from this rather than assuming a fixed minute, since the delay escalates.
  retryAfterSeconds: number;
}

interface Dependencies {
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel;
  userRepository: UserRepository;
  expiryMinutes?: number;
}

export class RequestConfirmationOtpUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly userRepository: UserRepository;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.userRepository = deps.userRepository;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RequestConfirmationOtpInput
  ): Promise<Result<RequestConfirmationOtpResult, string>> {
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
        phone,
        this.deliveryChannel.channel,
        OtpPurposes.PHONE_CONFIRMATION
      );

      if (throttle.retryAfterSeconds > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      // 3. Generate code, hash it
      const code = OtpCode.generate();
      const hashedCode = this.otpCodeHasher.hash(code.getValue());

      // 4. Save OtpVerification with userId
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      const otpVerification = OtpVerification.create({
        identifier: phone,
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.PHONE_CONFIRMATION,
        code: hashedCode,
        clientIp: input.clientIp,
        expiresAt,
        userId: user.id,
      });

      const saved = await this.otpRepository.save(otpVerification);

      // 5. Send via delivery channel
      const deliveryResult = await this.deliveryChannel.send(
        phone,
        code.getValue(),
        user.language,
        input.clientIp,
        OtpPurposes.PHONE_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        otpId: saved.id,
        expiresAt,
        backdoorCode: deliveryResult.backdoorCode,
        expiresInSeconds: this.expiryMinutes * 60,
        // The code just sent joins the window, so the next request waits
        // the following tier.
        retryAfterSeconds: calculateThrottleDelay(throttle.recentCount + 1),
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : OtpErrors.SEND_FAILED
      );
    }
  }
}
