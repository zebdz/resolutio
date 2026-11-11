import { AuthenticationError } from './AuthenticationError';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { OtpCodeGenerator } from './OtpCodeGenerator';
import { OtpVerificationId } from '@/domain/shared/EntityIds';
import { OtpEmailDestination } from '@/domain/otp/OtpValues';
import {
  ClientIp,
  Minutes,
  afterSeconds,
  secondsFromMinutes,
} from '@/domain/auth/AuthValues';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';

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
 * Unauthenticated. Every outcome that depends on account state — unknown
 * account, no address, unconfirmed address, throttled, delivery failed, even
 * an unexpected fault — reports the same success, so the response is not an
 * oracle for which accounts exist. Only a syntactically unusable identifier is
 * reported as a failure, and that verdict reveals nothing.
 */
export class RequestPasswordResetUseCase {
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
    input: RequestPasswordResetInput
  ): Promise<Result<{ requested: true }, AuthenticationError>> {
    const now = this.clock.now();

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

      await this.issueIfEligible(user, input.clientIp, now);
    } catch (error) {
      // Log it, then report exactly what the happy path reports.
      console.error('Password reset request failed:', error);
    }

    return success({ requested: true });
  }

  private async issueIfEligible(
    user: User | null,
    clientIp: string,
    now: Instant
  ): Promise<void> {
    if (!user || !user.hasConfirmedEmail() || !user.email) {
      return;
    }

    const address = user.email.getValue();

    const throttle = await readThrottle(
      this.otpRepository,
      OtpEmailDestination.parse({
        identifier: address,
        channel: this.deliveryChannel.channel,
      }),
      OtpPurposes.PASSWORD_RESET,
      now
    );

    if (throttle.retryAfterSeconds > 0) {
      return;
    }

    const code = this.otpCodeGenerator.generate();

    await this.otpRepository.save(
      OtpVerification.create(
        {
          ...OtpEmailDestination.parse({
            identifier: address,
            channel: this.deliveryChannel.channel,
          }),

          purpose: OtpPurposes.PASSWORD_RESET,
          code: this.otpCodeHasher.hash(code.getValue()),
          clientIp: ClientIp.parse(clientIp),
          expiresAt: afterSeconds(now, secondsFromMinutes(this.expiryMinutes)),
          userId: user.id,
        },
        { id: this.ids.generate(OtpVerificationId), now }
      )
    );

    await this.deliveryChannel.send(
      OtpEmailDestination.parse({
        channel: this.deliveryChannel.channel,
        identifier: address,
      }).identifier,
      code.getValue(),
      user.language,
      ClientIp.parse(clientIp),
      OtpPurposes.PASSWORD_RESET
    );
  }
}
