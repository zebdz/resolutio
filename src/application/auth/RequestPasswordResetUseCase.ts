import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { AuthErrors } from './AuthErrors';
import { parseAccountIdentifier } from './parseAccountIdentifier';
import { readThrottle } from './OtpThrottleCalculator';

export interface RequestPasswordResetInput {
  identifier: string;
  clientIp: string;
}

interface Dependencies {
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  deliveryChannel: OtpDeliveryChannel;
  otpCodeHasher: OtpCodeHasher;
  expiryMinutes?: number;
}

/**
 * Unauthenticated. Every outcome that depends on account state — unknown
 * account, no address, unconfirmed address, throttled, delivery failed, even
 * an unexpected fault — reports the same success, so the response is not an
 * oracle for which accounts exist. Only a syntactically unusable identifier is
 * reported as a failure, and that verdict reveals nothing.
 */
export class RequestPasswordResetUseCase {
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
    input: RequestPasswordResetInput
  ): Promise<Result<{ requested: true }, string>> {
    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    const parsed = parseAccountIdentifier(input.identifier);

    if (!parsed) {
      return failure(UserDomainCodes.EMAIL_INVALID);
    }

    try {
      const user =
        parsed.kind === 'email'
          ? await this.userRepository.findByEmail(parsed.email)
          : await this.userRepository.findByPhoneNumber(parsed.phone);

      await this.issueIfEligible(user, input.clientIp);
    } catch (error) {
      // Log it, then report exactly what the happy path reports.
      console.error('Password reset request failed:', error);
    }

    return success({ requested: true });
  }

  private async issueIfEligible(
    user: User | null,
    clientIp: string
  ): Promise<void> {
    if (!user || !user.hasConfirmedEmail() || !user.email) {
      return;
    }

    const address = user.email.getValue();

    const throttle = await readThrottle(
      this.otpRepository,
      address,
      this.deliveryChannel.channel,
      OtpPurposes.PASSWORD_RESET
    );

    if (throttle.retryAfterSeconds > 0) {
      return;
    }

    const code = OtpCode.generate();

    await this.otpRepository.save(
      OtpVerification.create({
        identifier: address,
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.PASSWORD_RESET,
        code: this.otpCodeHasher.hash(code.getValue()),
        clientIp,
        expiresAt: new Date(Date.now() + this.expiryMinutes * 60 * 1000),
        userId: user.id,
      })
    );

    await this.deliveryChannel.send(
      address,
      code.getValue(),
      user.language,
      clientIp,
      OtpPurposes.PASSWORD_RESET
    );
  }
}
