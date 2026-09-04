import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { SESSION_TTL_MS } from './LoginUserUseCase';
import type { Language } from '@/domain/user/User';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
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
  otpId: string;
  expiresAt: Date;
  backdoorCode?: string;
  expiresInSeconds: number;
  emailOtpId?: string;
}

interface Dependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  otpRepository: OtpRepository;
  sessionRepository: SessionRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel;
  /** Optional: when absent, an email supplied at registration is stored but no
   * confirmation code goes out. The user can request one from the account page. */
  emailDeliveryChannel?: OtpDeliveryChannel;
  profanityChecker?: ProfanityChecker;
  expiryMinutes?: number;
}

export class RegisterUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly otpRepository: OtpRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly emailDeliveryChannel?: OtpDeliveryChannel;
  private readonly profanityChecker?: ProfanityChecker;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.passwordHasher = deps.passwordHasher;
    this.otpRepository = deps.otpRepository;
    this.sessionRepository = deps.sessionRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.emailDeliveryChannel = deps.emailDeliveryChannel;
    this.profanityChecker = deps.profanityChecker;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RegisterUserInput
  ): Promise<Result<RegisterResult, string>> {
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
    const hashedPassword = await this.passwordHasher.hash(input.password);

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

      // Update user data in-place via save (upsert)
      const updatedUser = User.reconstitute({
        id: existingUser.id,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        phoneNumber,
        password: hashedPassword,
        language: input.language || 'ru',
        createdAt: existingUser.createdAt,
        consentGivenAt: new Date(),
        nickname: existingUser.nickname,
        allowFindByName: existingUser.allowFindByName,
        allowFindByPhone: existingUser.allowFindByPhone,
        privacySetupCompleted: existingUser.privacySetupCompleted,
        // no confirmedAt — stays unconfirmed
        // A re-registration may supply a new address; it starts unconfirmed
        // either way. Omitting it keeps whatever was there before.
        email: email ?? existingUser.email,
        emailConfirmedAt: undefined,
      });

      savedUser = await this.userRepository.save(updatedUser);
    } else {
      // New user
      let nickname = Nickname.generate();
      const MAX_NICKNAME_RETRIES = 5;

      for (let i = 0; i < MAX_NICKNAME_RETRIES; i++) {
        const available = await this.userRepository.isNicknameAvailable(
          nickname.getValue()
        );

        if (available) {
          break;
        }

        nickname = Nickname.generate();
      }

      const user = User.create(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
          phoneNumber,
          password: hashedPassword,
          language: input.language || 'ru',
          consentGivenAt: new Date(),
          nickname,
          email,
        },
        this.profanityChecker
      );

      savedUser = await this.userRepository.save(user);
    }

    // 5. Create session
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await this.sessionRepository.create(
      savedUser.id,
      expiresAt,
      input.ipAddress,
      input.userAgent
    );

    // 6. Generate + send OTP
    const code = OtpCode.generate();
    const hashedCode = this.otpCodeHasher.hash(code.getValue());

    const otpExpiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    const otpVerification = OtpVerification.create({
      identifier: phoneNumber.getValue(),
      channel: this.deliveryChannel.channel,
      purpose: OtpPurposes.PHONE_CONFIRMATION,
      code: hashedCode,
      clientIp: input.clientIp,
      expiresAt: otpExpiresAt,
      userId: savedUser.id,
    });

    const savedOtp = await this.otpRepository.save(otpVerification);

    const deliveryResult = await this.deliveryChannel.send(
      phoneNumber.getValue(),
      code.getValue(),
      savedUser.language,
      input.clientIp,
      OtpPurposes.PHONE_CONFIRMATION
    );

    if (!deliveryResult.success) {
      return failure(OtpErrors.SEND_FAILED);
    }

    // 7. If an address was supplied, send its confirmation code too. The user
    // enters it later from the account page rather than here — registration
    // already asks for one code, and stacking a second would be heavy.
    const emailOtpId = await this.issueEmailConfirmation(
      email,
      savedUser,
      input.clientIp,
      otpExpiresAt
    );

    return success({
      user: savedUser,
      session,
      otpId: savedOtp.id,
      expiresAt: otpExpiresAt,
      backdoorCode: deliveryResult.backdoorCode,
      expiresInSeconds: this.expiryMinutes * 60,
      emailOtpId,
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
    expiresAt: Date
  ): Promise<string | undefined> {
    if (!email || !this.emailDeliveryChannel) {
      return undefined;
    }

    try {
      const emailCode = OtpCode.generate();

      const savedEmailOtp = await this.otpRepository.save(
        OtpVerification.create({
          identifier: email.getValue(),
          channel: this.emailDeliveryChannel.channel,
          purpose: OtpPurposes.EMAIL_CONFIRMATION,
          code: this.otpCodeHasher.hash(emailCode.getValue()),
          clientIp,
          expiresAt,
          userId: savedUser.id,
        })
      );

      await this.emailDeliveryChannel.send(
        email.getValue(),
        emailCode.getValue(),
        savedUser.language,
        clientIp,
        OtpPurposes.EMAIL_CONFIRMATION
      );

      return savedEmailOtp.id;
    } catch (error) {
      console.error(
        'Failed to issue the registration email confirmation code:',
        error instanceof Error ? error.message : error
      );

      return undefined;
    }
  }
}
