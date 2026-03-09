import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { DuplicateError, ValidationError } from '@/domain/shared/errors';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
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
}

interface Dependencies {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  otpRepository: OtpRepository;
  sessionRepository: SessionRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel;
  expiryMinutes?: number;
}

export class RegisterUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly otpRepository: OtpRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly expiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.passwordHasher = deps.passwordHasher;
    this.otpRepository = deps.otpRepository;
    this.sessionRepository = deps.sessionRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.expiryMinutes = deps.expiryMinutes ?? 10;
  }

  async execute(
    input: RegisterUserInput
  ): Promise<Result<RegisterResult, Error>> {
    try {
      // 1. Validate consent
      if (!input.consentGiven) {
        return failure(new ValidationError(AuthErrors.CONSENT_NOT_GIVEN));
      }

      // 2. Validate phone
      const phoneNumber = PhoneNumber.create(input.phoneNumber);

      // 3. Hash password
      const hashedPassword = await this.passwordHasher.hash(input.password);

      // 4. Check existing user
      const existingUser =
        await this.userRepository.findByPhoneNumber(phoneNumber);

      let savedUser: User;

      if (existingUser) {
        if (existingUser.isConfirmed()) {
          return failure(new DuplicateError('User', 'phone number'));
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

        const user = User.create({
          firstName: input.firstName,
          lastName: input.lastName,
          middleName: input.middleName,
          phoneNumber,
          password: hashedPassword,
          language: input.language || 'ru',
          consentGivenAt: new Date(),
          nickname,
        });

        savedUser = await this.userRepository.save(user);
      }

      // 5. Create session
      const SESSION_TTL_MS = 1 * 24 * 60 * 60 * 1000;
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

      const otpExpiresAt = new Date(
        Date.now() + this.expiryMinutes * 60 * 1000
      );

      const otpVerification = OtpVerification.create({
        identifier: phoneNumber.getValue(),
        channel: this.deliveryChannel.channel,
        code: hashedCode,
        clientIp: input.clientIp,
        expiresAt: otpExpiresAt,
        userId: savedUser.id,
      });

      const savedOtp = await this.otpRepository.save(otpVerification);

      const deliveryResult = await this.deliveryChannel.send(
        phoneNumber.getValue(),
        code.getValue(),
        savedUser.language
      );

      if (!deliveryResult.success) {
        return failure(new Error(OtpErrors.SEND_FAILED));
      }

      return success({
        user: savedUser,
        session,
        otpId: savedOtp.id,
        expiresAt: otpExpiresAt,
        backdoorCode: deliveryResult.backdoorCode,
        expiresInSeconds: this.expiryMinutes * 60,
      });
    } catch (error) {
      return failure(error as Error);
    }
  }
}
