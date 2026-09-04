import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { UserRepository } from '@/domain/user/UserRepository';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { getRetryAfter, THROTTLE_WINDOW_HOURS } from './OtpThrottleCalculator';

export interface RequestEmailConfirmationOtpInput {
  userId: string;
  clientIp: string;
}

export interface RequestEmailConfirmationOtpResult {
  otpId: string;
  expiresAt: Date;
  backdoorCode?: string;
  expiresInSeconds: number;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  deliveryChannel: OtpDeliveryChannel;
  otpCodeHasher: OtpCodeHasher;
  expiryMinutes?: number;
}

/**
 * Issues a confirmation code to the address a signed-in user has on file.
 * The caller is authenticated, so failures name their real cause — unlike the
 * password-reset flow, there is nothing here to hide from them.
 */
export class RequestEmailConfirmationOtpUseCase {
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RequestEmailConfirmationOtpInput
  ): Promise<Result<RequestEmailConfirmationOtpResult, string>> {
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

      const recentCount = await this.otpRepository.countRecentByIdentifier(
        address,
        this.deliveryChannel.channel,
        OtpPurposes.EMAIL_CONFIRMATION,
        THROTTLE_WINDOW_HOURS
      );

      const lastOtp = await this.otpRepository.findLatestByIdentifier(
        address,
        this.deliveryChannel.channel,
        OtpPurposes.EMAIL_CONFIRMATION
      );

      if (getRetryAfter(recentCount, lastOtp?.createdAt ?? null) > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      const code = OtpCode.generate();
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      const saved = await this.otpRepository.save(
        OtpVerification.create({
          identifier: address,
          channel: this.deliveryChannel.channel,
          purpose: OtpPurposes.EMAIL_CONFIRMATION,
          code: this.otpCodeHasher.hash(code.getValue()),
          clientIp: input.clientIp,
          expiresAt,
          userId: user.id,
        })
      );

      const deliveryResult = await this.deliveryChannel.send(
        address,
        code.getValue(),
        user.language,
        input.clientIp,
        OtpPurposes.EMAIL_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        otpId: saved.id,
        expiresAt,
        backdoorCode: deliveryResult.backdoorCode,
        expiresInSeconds: this.expiryMinutes * 60,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : OtpErrors.SEND_FAILED
      );
    }
  }
}
