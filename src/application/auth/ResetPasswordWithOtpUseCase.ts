/** Verifies account ownership before validating and replacing a password.
 * Plaintext enters the hashing port only after policy checks; successful resets revoke sessions. */
import { AuthenticationError } from './AuthenticationError';
import { PlaintextPassword } from '@/domain/user/UserValues';

import { Clock } from '@/application/shared/EntityCreation';
import { OtpDestination } from '@/domain/otp/OtpValues';

import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository } from '@/domain/user/SessionRepository';
import {
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '@/domain/user/User';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';
import { Result, success, failure } from '@/domain/shared/Result';
import { OtpCodeHasher, verifyEnteredOtpCode } from './OtpCodeHasher';
import { OtpErrors } from './OtpErrors';
import { PasswordHasher } from './RegisterUserUseCase';
import { parseAccountIdentifier } from './parseAccountIdentifier';

export interface ResetPasswordWithOtpInput {
  identifier: string;
  code: string;
  newPassword: string;
}

interface Dependencies {
  clock: Clock;
  userRepository: UserRepository;
  otpRepository: OtpRepository;
  sessionRepository: SessionRepository;
  otpCodeHasher: OtpCodeHasher;
  passwordHasher: PasswordHasher;
}

/**
 * Unauthenticated. The user is derived from the identifier and then checked
 * against the OTP row's own userId — never from anything the client asserts
 * about who it is. An unknown account, a missing code and a wrong code are all
 * reported identically, so step two is no more of an oracle than step one.
 */
export class ResetPasswordWithOtpUseCase {
  private readonly clock: Clock;
  private readonly userRepository: UserRepository;
  private readonly otpRepository: OtpRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly otpCodeHasher: OtpCodeHasher;
  private readonly passwordHasher: PasswordHasher;

  constructor(deps: Dependencies) {
    this.clock = deps.clock;
    this.userRepository = deps.userRepository;
    this.otpRepository = deps.otpRepository;
    this.sessionRepository = deps.sessionRepository;
    this.otpCodeHasher = deps.otpCodeHasher;
    this.passwordHasher = deps.passwordHasher;
  }

  async execute(
    input: ResetPasswordWithOtpInput
  ): Promise<Result<{ reset: true }, AuthenticationError>> {
    const now = this.clock.now();
    const parsed = parseAccountIdentifier(input.identifier);

    if (!parsed) {
      return failure(OtpErrors.INVALID);
    }

    const user =
      parsed.kind === 'email'
        ? await this.userRepository.findByEmail(parsed.email)
        : await this.userRepository.findByPhoneNumber(parsed.phone);

    if (!user || !user.hasConfirmedEmail() || !user.email) {
      return failure(OtpErrors.INVALID);
    }

    const otp = await this.otpRepository.findLatestByIdentifier(
      OtpDestination.parse({
        identifier: user.email.getValue(),
        channel: 'email',
      }),
      OtpPurposes.PASSWORD_RESET
    );

    if (!otp) {
      return failure(OtpErrors.INVALID);
    }

    // Defence in depth: findLatestByIdentifier already filters on purpose, but
    // the guard is free and this is the endpoint that would pay for a lapse.
    if (otp.purpose !== OtpPurposes.PASSWORD_RESET) {
      return failure(OtpErrors.INVALID);
    }

    // The row's own userId is the authority on whose password this changes.
    if (otp.userId !== user.id) {
      return failure(OtpErrors.INVALID);
    }

    if (otp.isVerified()) {
      return failure(OtpErrors.ALREADY_VERIFIED);
    }

    if (otp.isExpired(now)) {
      return failure(OtpErrors.EXPIRED);
    }

    if (otp.hasMaxAttempts()) {
      return failure(OtpErrors.MAX_ATTEMPTS);
    }

    const incremented = otp.incrementAttempts();
    await this.otpRepository.update(incremented);

    if (!verifyEnteredOtpCode(this.otpCodeHasher, input.code, otp.code)) {
      return failure(OtpErrors.INVALID);
    }

    // Password rules are checked only after the code proves the caller owns
    // the account. Checked earlier, the validation messages would themselves
    // tell an attacker which accounts exist.
    if (!input.newPassword || input.newPassword.length < PASSWORD_MIN_LENGTH) {
      return failure(UserDomainCodes.PASSWORD_TOO_SHORT);
    }

    if (
      passwordMatchesPersonalInfo(input.newPassword, {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        email: user.email?.getValue(),
      })
    ) {
      return failure(UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO);
    }

    const password = PlaintextPassword.parse(input.newPassword);
    await this.otpRepository.update(incremented.markVerified(now));

    const hashedPassword = await this.passwordHasher.hash(password);
    await this.userRepository.save(user.changePassword(hashedPassword));

    // Every live session was opened with the old password. A reset prompted by
    // a suspected compromise is pointless if the compromiser keeps their access.
    await this.sessionRepository.deleteAllForUser(user.id);

    return success({ reset: true });
  }
}
