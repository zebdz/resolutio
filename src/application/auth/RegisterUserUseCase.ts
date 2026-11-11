/** Coordinates registration with injected identity, time and nickname sources.
 * Persisted credentials and names are validated before constructing the aggregate. */
import { SessionTokenGenerator } from './SessionTokenGenerator';
import { UserAgent } from '@/domain/user/Session';
import { OtpCodeGenerator } from './OtpCodeGenerator';
import { OtpVerificationId } from '@/domain/shared/EntityIds';
import { OtpSmsDestination, OtpEmailDestination } from '@/domain/otp/OtpValues';
import {
  ClientIp,
  Minutes,
  Seconds,
  afterSeconds,
  secondsFromMinutes,
} from '@/domain/auth/AuthValues';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { NicknameGenerator } from './NicknameGenerator';
import {
  FirstName,
  LastName,
  MiddleName,
  PasswordHash,
  PlaintextPassword,
} from '@/domain/user/UserValues';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';

import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes, UserDomainCode } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors, OtpError } from './OtpErrors';
import { AuthErrors, AuthError } from './AuthErrors';
import { readOtpStatus, shouldIssueCode } from './OtpStatus';
import { SESSION_TTL_SECONDS } from './LoginUserUseCase';
import type { Language } from '@/domain/user/User';

export interface PasswordHasher {
  hash(password: PlaintextPassword): Promise<PasswordHash>;
}

export interface RegisterUserInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
  password: string;
  email?: string;
  language?: Language;
  consentGiven: boolean;
  clientIp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterResult {
  user: User;
  session: Session;
  // Lifetime for the session cookie. Distinct from the OTP window: copying
  // that into the cookie once logged registrants out ten minutes in.
  sessionExpiresInSeconds: Seconds;
}

interface Dependencies {
  sessionTokenGenerator: SessionTokenGenerator;
  otpCodeGenerator: OtpCodeGenerator;
  ids: IdGenerator;
  clock: Clock;
  nicknameGenerator: NicknameGenerator;
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  otpRepository: OtpRepository;
  sessionRepository: SessionRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel<'sms'>;
  /** Optional: when absent, an email supplied at registration is stored but no
   * confirmation code goes out. The user can request one from the account page. */
  emailDeliveryChannel?: OtpDeliveryChannel<'email'>;
  profanityChecker?: ProfanityChecker;
  expiryMinutes?: Minutes;
}

export class RegisterUserUseCase {
  private readonly sessionTokenGenerator: SessionTokenGenerator;
  private readonly otpCodeGenerator: OtpCodeGenerator;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly nicknameGenerator: NicknameGenerator;
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly otpRepository: OtpRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel<'sms'>;
  private readonly emailDeliveryChannel?: OtpDeliveryChannel<'email'>;
  private readonly profanityChecker?: ProfanityChecker;
  private readonly expiryMinutes: Minutes;

  constructor(deps: Dependencies) {
    this.sessionTokenGenerator = deps.sessionTokenGenerator;
    this.otpCodeGenerator = deps.otpCodeGenerator;
    this.ids = deps.ids;
    this.clock = deps.clock;
    this.nicknameGenerator = deps.nicknameGenerator;
    this.userRepository = deps.userRepository;
    this.passwordHasher = deps.passwordHasher;
    this.otpRepository = deps.otpRepository;
    this.sessionRepository = deps.sessionRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.emailDeliveryChannel = deps.emailDeliveryChannel;
    this.profanityChecker = deps.profanityChecker;
    this.expiryMinutes = deps.expiryMinutes ?? Minutes.parse(10);
  }

  async execute(
    input: RegisterUserInput
  ): Promise<Result<RegisterResult, AuthError | UserDomainCode | OtpError>> {
    // 1. Validate IP
    if (!input.clientIp) {
      return failure(AuthErrors.MISSING_IP);
    }

    // 2. Validate consent
    if (!input.consentGiven) {
      return failure(AuthErrors.CONSENT_NOT_GIVEN);
    }

    // 2. Validate phone
    const phoneNumber = PhoneNumber.create(input.phoneNumber);

    // 3. Hash password
    const hashedPassword = PasswordHash.parse(
      await this.passwordHasher.hash(PlaintextPassword.parse(input.password))
    );
    const now = this.clock.now();

    // 4. Check existing user
    const existingUser =
      await this.userRepository.findByPhoneNumber(phoneNumber);

    // 4a. Resolve the optional email. An empty string is "not provided" — the
    // form always submits the field, blank or not.
    let email: EmailAddress | undefined;

    if (input.email && input.email.trim().length > 0) {
      try {
        email = EmailAddress.create(input.email);
      } catch {
        return failure(UserDomainCodes.EMAIL_INVALID);
      }

      const emailOwner = await this.userRepository.findByEmail(email);

      if (emailOwner && emailOwner.id !== existingUser?.id) {
        return failure(UserDomainCodes.EMAIL_TAKEN);
      }
    }

    let savedUser: User;

    if (existingUser) {
      if (existingUser.isConfirmed()) {
        return failure(AuthErrors.PHONE_EXISTS);
      }

      // Re-registration of unconfirmed user: invalidate sessions, update data
      await this.sessionRepository.deleteAllForUser(existingUser.id);

      // Change registration details through domain behavior, retaining privacy/address state.
      const updatedUser = existingUser.updateRegistrationDetails(
        {
          firstName: FirstName.parse(input.firstName),
          lastName: LastName.parse(input.lastName),
          middleName: input.middleName
            ? MiddleName.parse(input.middleName)
            : undefined,
          phoneNumber,
          password: hashedPassword,
          language: input.language ?? 'ru',
          email,
        },
        now,
        this.profanityChecker
      );

      savedUser = await this.userRepository.save(updatedUser);
    } else {
      // New user
      let nickname = this.nicknameGenerator.generate();
      const MAX_NICKNAME_RETRIES = 5;

      for (let i = 0; i < MAX_NICKNAME_RETRIES; i++) {
        const available =
          await this.userRepository.isNicknameAvailable(nickname);

        if (available) {
          break;
        }

        nickname = this.nicknameGenerator.generate();
      }

      const user = User.create(
        {
          firstName: FirstName.parse(input.firstName),
          lastName: LastName.parse(input.lastName),
          middleName: input.middleName
            ? MiddleName.parse(input.middleName)
            : undefined,
          phoneNumber,
          password: hashedPassword,
          language: input.language || 'ru',
          consentGivenAt: now,
          nickname,
          email,
        },
        { id: this.ids.generate(UserId), now },
        this.profanityChecker
      );

      savedUser = await this.userRepository.save(user);
    }

    // 5. Create session
    const expiresAt = afterSeconds(now, SESSION_TTL_SECONDS);
    const session = await this.sessionRepository.save(
      Session.create(
        {
          userId: savedUser.id,
          expiresAt,
          ipAddress:
            input.ipAddress === undefined
              ? null
              : ClientIp.parse(input.ipAddress),
          userAgent:
            input.userAgent === undefined
              ? null
              : UserAgent.parse(input.userAgent),
        },
        { id: this.sessionTokenGenerator.generate(), now }
      )
    );

    // 6. Send a code, unless one is pending or the throttle says wait: the
    // same rule as login, so re-registering an unconfirmed phone cannot pump
    // SMS. A brand-new account has no code yet, so its first one always goes
    // out. Either way the confirm-phone page shows what applies.
    const otpExpiresAt = afterSeconds(
      now,
      secondsFromMinutes(this.expiryMinutes)
    );

    const status = await readOtpStatus(
      this.otpRepository,
      {
        destination: OtpSmsDestination.parse({
          identifier: phoneNumber.getValue(),
          channel: this.deliveryChannel.channel,
        }),
        userId: savedUser.id,

        purpose: OtpPurposes.PHONE_CONFIRMATION,
      },
      now
    );

    if (shouldIssueCode(status)) {
      const code = this.otpCodeGenerator.generate();

      await this.otpRepository.save(
        OtpVerification.create(
          {
            ...OtpSmsDestination.parse({
              identifier: phoneNumber.getValue(),
              channel: this.deliveryChannel.channel,
            }),

            purpose: OtpPurposes.PHONE_CONFIRMATION,
            code: this.otpCodeHasher.hash(code.getValue()),
            clientIp: ClientIp.parse(input.clientIp),
            expiresAt: otpExpiresAt,
            userId: savedUser.id,
          },
          { id: this.ids.generate(OtpVerificationId), now }
        )
      );

      const deliveryResult = await this.deliveryChannel.send(
        OtpSmsDestination.parse({
          channel: this.deliveryChannel.channel,
          identifier: phoneNumber.getValue(),
        }).identifier,
        code.getValue(),
        savedUser.language,
        ClientIp.parse(input.clientIp),
        OtpPurposes.PHONE_CONFIRMATION
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }
    }

    // 7. If an address was supplied, send its confirmation code too. The user
    // enters it later from the account page rather than here — registration
    // already asks for one code, and stacking a second would be heavy.
    await this.issueEmailConfirmation(
      email,
      savedUser,
      input.clientIp,
      otpExpiresAt,
      now
    );

    return success({
      user: savedUser,
      session,
      sessionExpiresInSeconds: SESSION_TTL_SECONDS,
    });
  }

  /**
   * Best effort by design: the phone flow is what gates the account, so a mail
   * server being down must not fail a registration. The user can request a
   * fresh code from the account page whenever they like.
   */
  private async issueEmailConfirmation(
    email: EmailAddress | undefined,
    savedUser: User,
    clientIp: string,
    expiresAt: Instant,
    now: Instant
  ): Promise<void> {
    if (!email || !this.emailDeliveryChannel) {
      return;
    }

    try {
      const emailCode = this.otpCodeGenerator.generate();

      await this.otpRepository.save(
        OtpVerification.create(
          {
            ...OtpEmailDestination.parse({
              identifier: email.getValue(),
              channel: this.emailDeliveryChannel.channel,
            }),

            purpose: OtpPurposes.EMAIL_CONFIRMATION,
            code: this.otpCodeHasher.hash(emailCode.getValue()),
            clientIp: ClientIp.parse(clientIp),
            expiresAt,
            userId: savedUser.id,
          },
          { id: this.ids.generate(OtpVerificationId), now }
        )
      );

      await this.emailDeliveryChannel.send(
        OtpEmailDestination.parse({
          channel: this.emailDeliveryChannel.channel,
          identifier: email.getValue(),
        }).identifier,
        emailCode.getValue(),
        savedUser.language,
        ClientIp.parse(clientIp),
        OtpPurposes.EMAIL_CONFIRMATION
      );
    } catch (error) {
      console.error(
        'Failed to issue the registration email confirmation code:',
        error instanceof Error ? error.message : error
      );
    }
  }
}
