import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import { OtpCode } from '@/domain/otp/OtpCode';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher } from './OtpCodeHasher';
import { OtpDeliveryChannel } from './OtpDeliveryChannel';
import { OtpErrors } from './OtpErrors';
import { AuthErrors } from './AuthErrors';
import { readOtpStatus, shouldIssueCode } from './OtpStatus';

export interface PasswordVerifier {
  verify(password: string, hash: string): Promise<boolean>;
}

export interface LoginUserInput {
  phoneNumber: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
}

export const SESSION_TTL_MS = 1 * 24 * 60 * 60 * 1000; // 1 day
export const SUPERADMIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface LoginResult {
  user: User;
  session: Session;
  expiresInSeconds: number;
  needsConfirmation?: true;
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

    // Unconfirmed user: make sure a code they can enter exists, and flag
    // needsConfirmation
    if (!user.isConfirmed()) {
      // Only when nothing can still be entered and the escalating throttle
      // allows it, judged from the same status the confirm-phone page renders
      // from. Re-sending on every login burned an SMS each time and, since the
      // page checks the latest code, made the one already in the inbox
      // useless. While the throttle runs, login still succeeds and the page
      // shows the wait.
      const status = await readOtpStatus(this.otpRepository, {
        userId: user.id,
        identifier: phoneNumber.getValue(),
        channel: this.deliveryChannel.channel,
        purpose: OtpPurposes.PHONE_CONFIRMATION,
      });

      if (shouldIssueCode(status)) {
        const sent = await this.sendConfirmationCode(
          user,
          phoneNumber,
          input.ipAddress
        );

        if (!sent) {
          return failure(OtpErrors.SEND_FAILED);
        }
      }

      return success({
        user,
        session,
        expiresInSeconds: Math.floor(ttlMs / 1000),
        needsConfirmation: true,
      });
    }

    return success({
      user,
      session,
      expiresInSeconds: Math.floor(ttlMs / 1000),
    });
  }

  private async sendConfirmationCode(
    user: User,
    phoneNumber: PhoneNumber,
    clientIp: string
  ): Promise<boolean> {
    const code = OtpCode.generate();
    const hashedCode = this.otpCodeHasher.hash(code.getValue());
    const otpExpiresAt = new Date(
      Date.now() + this.otpExpiryMinutes * 60 * 1000
    );

    const otpVerification = OtpVerification.create({
      identifier: phoneNumber.getValue(),
      channel: this.deliveryChannel.channel,
      purpose: OtpPurposes.PHONE_CONFIRMATION,
      code: hashedCode,
      clientIp,
      expiresAt: otpExpiresAt,
      userId: user.id,
    });

    await this.otpRepository.save(otpVerification);

    const deliveryResult = await this.deliveryChannel.send(
      phoneNumber.getValue(),
      code.getValue(),
      user.language,
      clientIp,
      OtpPurposes.PHONE_CONFIRMATION
    );

    return deliveryResult.success;
  }
}
