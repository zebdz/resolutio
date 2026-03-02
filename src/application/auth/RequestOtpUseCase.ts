import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { Result, success, failure } from '@/domain/shared/Result';
import { CaptchaVerifier } from './CaptchaVerifier';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { getRetryAfter } from './OtpThrottleCalculator';

export interface RequestOtpInput {
  phoneNumber: string;
  captchaToken: string;
  clientIp: string;
  locale: string;
}

export interface RequestOtpResult {
  otpId: string;
  expiresAt: Date;
  backdoorCode?: string;
  retryAfter?: number;
}

interface Dependencies {
  otpRepository: OtpRepository;
  captchaVerifier: CaptchaVerifier;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel;
  expiryMinutes?: number;
}

export class RequestOtpUseCase {
  private readonly otpRepository: OtpRepository;
  private readonly captchaVerifier: CaptchaVerifier;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.otpRepository = deps.otpRepository;
    this.captchaVerifier = deps.captchaVerifier;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RequestOtpInput
  ): Promise<Result<RequestOtpResult, string>> {
    try {
      // 1. Verify CAPTCHA
      const captchaValid = await this.captchaVerifier.verify(
        input.captchaToken,
        input.clientIp
      );

      if (!captchaValid) {
        return failure(OtpErrors.CAPTCHA_FAILED);
      }

      // 2. Validate phone
      const phoneNumber = PhoneNumber.create(input.phoneNumber);

      // 3. Check throttle (count recent OTPs for IP in 24h)
      const recentCount = await this.otpRepository.countRecentByClientIp(
        input.clientIp,
        24
      );

      const lastOtp = await this.otpRepository.findLatestByIdentifier(
        phoneNumber.getValue(),
        this.deliveryChannel.channel
      );

      const retryAfter = getRetryAfter(recentCount, lastOtp?.createdAt ?? null);

      if (retryAfter > 0) {
        return failure(OtpErrors.THROTTLED);
      }

      // 4. Generate code, hash it
      const code = OtpCode.generate();
      const hashedCode = this.otpCodeHasher.hash(code.getValue());

      // 5. Save OtpVerification entity
      const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

      const otpVerification = OtpVerification.create({
        identifier: phoneNumber.getValue(),
        channel: this.deliveryChannel.channel,
        code: hashedCode,
        clientIp: input.clientIp,
        expiresAt,
      });

      const saved = await this.otpRepository.save(otpVerification);

      // 6. Send via delivery channel
      const deliveryResult = await this.deliveryChannel.send(
        phoneNumber.getValue(),
        code.getValue(),
        input.locale
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      // 7. Return result
      return success({
        otpId: saved.id,
        expiresAt,
        backdoorCode: deliveryResult.backdoorCode,
      });
    } catch (error) {
      return failure(
        error instanceof Error ? error.message : OtpErrors.SEND_FAILED
      );
    }
  }
}
