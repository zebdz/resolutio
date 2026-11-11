/** Opens authenticated sessions with explicit time and secure token generation.
 * Unconfirmed users share the same OTP issuance and throttle policy as registration. */
import { SessionTokenGenerator } from './SessionTokenGenerator';
import { UserAgent } from '@/domain/user/Session';
import { AuthenticationError } from './AuthenticationError';
import { PasswordHash, PlaintextPassword } from '@/domain/user/UserValues';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { OtpCodeGenerator } from './OtpCodeGenerator';
import { OtpVerificationId } from '@/domain/shared/EntityIds';
import { OtpSmsDestination } from '@/domain/otp/OtpValues';
import {
  ClientIp,
  Minutes,
  Seconds,
  afterSeconds,
  secondsFromMinutes,
} from '@/domain/auth/AuthValues';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';

import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { readOtpStatus, shouldIssueCode } from './OtpStatus';

export interface PasswordVerifier {
  verify(password: PlaintextPassword, hash: PasswordHash): Promise<boolean>;
}

export interface LoginUserInput {
  phoneNumber: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
}

export const SESSION_TTL_SECONDS = Seconds.parse(24 * 60 * 60); // 1 day
export const SUPERADMIN_SESSION_TTL_SECONDS = Seconds.parse(4 * 60 * 60); // 4 hours
// Millisecond constants remain an adapter compatibility export.
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
export const SUPERADMIN_SESSION_TTL_MS = SUPERADMIN_SESSION_TTL_SECONDS * 1000;

export interface LoginResult {
  user: User;
  session: Session;
  expiresInSeconds: Seconds;
  needsConfirmation?: true;
}

interface Dependencies {
  sessionTokenGenerator: SessionTokenGenerator;
  ids: IdGenerator;
  otpCodeGenerator: OtpCodeGenerator;
  clock: Clock;
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordVerifier: PasswordVerifier;
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel<'sms'>;
  otpExpiryMinutes?: Minutes;
}

export class LoginUserUseCase {
  private readonly sessionTokenGenerator: SessionTokenGenerator;
  private readonly ids: IdGenerator;
  private readonly otpCodeGenerator: OtpCodeGenerator;
  private readonly clock: Clock;
  private readonly userRepository: UserRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly passwordVerifier: PasswordVerifier;
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel<'sms'>;
  private readonly otpExpiryMinutes: Minutes;

  constructor(deps: Dependencies) {
    this.sessionTokenGenerator = deps.sessionTokenGenerator;
    this.ids = deps.ids;
    this.otpCodeGenerator = deps.otpCodeGenerator;
    this.clock = deps.clock;
    this.userRepository = deps.userRepository;
    this.sessionRepository = deps.sessionRepository;
    this.passwordVerifier = deps.passwordVerifier;
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpExpiryMinutes = deps.otpExpiryMinutes ?? Minutes.parse(10);
  }

  async execute(
    input: LoginUserInput
  ): Promise<Result<LoginResult, AuthenticationError>> {
    const now = this.clock.now();

    if (!input.ipAddress) {
      return failure(AuthErrors.MISSING_IP);
    }

    // Create phone number value object
    const phoneNumber = PhoneNumber.create(input.phoneNumber);

    // Find user by phone number
    const user = await this.userRepository.findByPhoneNumber(phoneNumber);

    if (!user) {
      return failure(AuthErrors.INVALID_CREDENTIALS);
    }

    // Verify password
    const isPasswordValid = await this.passwordVerifier.verify(
      PlaintextPassword.parse(input.password),
      user.password
    );

    if (!isPasswordValid) {
      return failure(AuthErrors.INVALID_CREDENTIALS);
    }

    // Superadmins get shorter session TTL
    const isSuperAdmin = await this.userRepository.isSuperAdmin(user.id);
    const ttl = isSuperAdmin
      ? SUPERADMIN_SESSION_TTL_SECONDS
      : SESSION_TTL_SECONDS;
    const expiresAt = afterSeconds(now, ttl);
    const session = await this.sessionRepository.save(
      Session.create(
        {
          userId: user.id,
          expiresAt,
          ipAddress: ClientIp.parse(input.ipAddress),
          userAgent:
            input.userAgent === undefined
              ? null
              : UserAgent.parse(input.userAgent),
        },
        { id: this.sessionTokenGenerator.generate(), now }
      )
    );

    // Unconfirmed user: make sure a code they can enter exists, and flag
    // needsConfirmation
    if (!user.isConfirmed()) {
      // Only when nothing can still be entered and the escalating throttle
      // allows it, judged from the same status the confirm-phone page renders
      // from. Re-sending on every login burned an SMS each time and, since the
      // page checks the latest code, made the one already in the inbox
      // useless. While the throttle runs, login still succeeds and the page
      // shows the wait.
      const status = await readOtpStatus(
        this.otpRepository,
        {
          destination: OtpSmsDestination.parse({
            identifier: phoneNumber.getValue(),
            channel: this.deliveryChannel.channel,
          }),
          userId: user.id,

          purpose: OtpPurposes.PHONE_CONFIRMATION,
        },
        now
      );

      if (shouldIssueCode(status)) {
        const sent = await this.sendConfirmationCode(
          user,
          phoneNumber,
          input.ipAddress,
          now
        );

        if (!sent) {
          return failure(OtpErrors.SEND_FAILED);
        }
      }

      return success({
        user,
        session,
        expiresInSeconds: ttl,
        needsConfirmation: true,
      });
    }

    return success({
      user,
      session,
      expiresInSeconds: ttl,
    });
  }

  private async sendConfirmationCode(
    user: User,
    phoneNumber: PhoneNumber,
    clientIp: string,
    now: Instant
  ): Promise<boolean> {
    const code = this.otpCodeGenerator.generate();
    const hashedCode = this.otpCodeHasher.hash(code.getValue());
    const otpExpiresAt = afterSeconds(
      now,
      secondsFromMinutes(this.otpExpiryMinutes)
    );

    const otpVerification = OtpVerification.create(
      {
        ...OtpSmsDestination.parse({
          identifier: phoneNumber.getValue(),
          channel: this.deliveryChannel.channel,
        }),

        purpose: OtpPurposes.PHONE_CONFIRMATION,
        code: hashedCode,
        clientIp: ClientIp.parse(clientIp),
        expiresAt: otpExpiresAt,
        userId: user.id,
      },
      { id: this.ids.generate(OtpVerificationId), now }
    );

    await this.otpRepository.save(otpVerification);

    const deliveryResult = await this.deliveryChannel.send(
      OtpSmsDestination.parse({
        channel: this.deliveryChannel.channel,
        identifier: phoneNumber.getValue(),
      }).identifier,
      code.getValue(),
      user.language,
      ClientIp.parse(clientIp),
      OtpPurposes.PHONE_CONFIRMATION
    );

    return deliveryResult.success;
  }
}
