import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';

export interface PasswordVerifier {
  verify(password: string, hash: string): Promise<boolean>;
}

export interface LoginUserInput {
  phoneNumber: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export const SESSION_TTL_MS = 1 * 24 * 60 * 60 * 1000; // 1 day
export const SUPERADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface LoginResult {
  user: User;
  session: Session;
  expiresInSeconds: number;
  needsConfirmation?: true;
  otpId?: string;
  expiresAt?: Date;
  backdoorCode?: string;
}

interface Dependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordVerifier: PasswordVerifier;
  otpRepository: OtpRepository;
  otpCodeHasher: OtpCodeHasher;
  deliveryChannel: OtpDeliveryChannel;
  otpExpiryMinutes?: number;
}

export class LoginUserUseCase {
  private readonly userRepository: UserRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly passwordVerifier: PasswordVerifier;
  private readonly otpRepository: OtpRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly deliveryChannel: OtpDeliveryChannel;
  private readonly otpExpiryMinutes: number;

  constructor(deps: Dependencies) {
    this.userRepository = deps.userRepository;
    this.sessionRepository = deps.sessionRepository;
    this.passwordVerifier = deps.passwordVerifier;
    this.otpRepository = deps.otpRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.deliveryChannel = deps.deliveryChannel;
    this.otpExpiryMinutes = deps.otpExpiryMinutes ?? 10;
  }

  async execute(input: LoginUserInput): Promise<Result<LoginResult, string>> {
    // Create phone number value object
    const phoneNumber = PhoneNumber.create(input.phoneNumber);

    // Find user by phone number
    const user = await this.userRepository.findByPhoneNumber(phoneNumber);

    if (!user) {
      return failure(AuthErrors.INVALID_CREDENTIALS);
    }

    // Verify password
    const isPasswordValid = await this.passwordVerifier.verify(
      input.password,
      user.password
    );

    if (!isPasswordValid) {
      return failure(AuthErrors.INVALID_CREDENTIALS);
    }

    // Superadmins get shorter session TTL
    const isSuperAdmin = await this.userRepository.isSuperAdmin(user.id);
    const ttlMs = isSuperAdmin ? SUPERADMIN_SESSION_TTL_MS : SESSION_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs);

    const session = await this.sessionRepository.create(
      user.id,
      expiresAt,
      input.ipAddress,
      input.userAgent
    );

    // Unconfirmed user: send OTP and flag needsConfirmation
    if (!user.isConfirmed()) {
      const code = OtpCode.generate();
      const hashedCode = this.otpCodeHasher.hash(code.getValue());
      const otpExpiresAt = new Date(
        Date.now() + this.otpExpiryMinutes * 60 * 1000
      );

      const otpVerification = OtpVerification.create({
        identifier: phoneNumber.getValue(),
        channel: this.deliveryChannel.channel,
        code: hashedCode,
        clientIp: input.ipAddress || '0.0.0.0',
        expiresAt: otpExpiresAt,
        userId: user.id,
      });

      const savedOtp = await this.otpRepository.save(otpVerification);

      const deliveryResult = await this.deliveryChannel.send(
        phoneNumber.getValue(),
        code.getValue(),
        user.language
      );

      if (!deliveryResult.success) {
        return failure(OtpErrors.SEND_FAILED);
      }

      return success({
        user,
        session,
        expiresInSeconds: Math.floor(ttlMs / 1000),
        needsConfirmation: true,
        otpId: savedOtp.id,
        expiresAt: otpExpiresAt,
        backdoorCode: deliveryResult.backdoorCode,
      });
    }

    return success({
      user,
      session,
      expiresInSeconds: Math.floor(ttlMs / 1000),
    });
  }
}
