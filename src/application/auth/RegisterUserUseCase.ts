import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UserRepository } from '@/domain/user/UserRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { DuplicateError, ValidationError } from '@/domain/shared/errors';
import { Result, success, failure } from '@/domain/shared/Result';
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
  otpId: string;
  consentGiven: boolean;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly otpRepository: OtpRepository
  ) {}

  async execute(input: RegisterUserInput): Promise<Result<User, Error>> {
    try {
      // Validate consent
      if (!input.consentGiven) {
        return failure(new ValidationError(AuthErrors.CONSENT_NOT_GIVEN));
      }

      // Verify OTP is verified and matches phone
      const otp = await this.otpRepository.findById(input.otpId);

      if (!otp || !otp.isVerified()) {
        return failure(new ValidationError(OtpErrors.NOT_VERIFIED));
      }

      if (otp.identifier !== input.phoneNumber) {
        return failure(new ValidationError(OtpErrors.PHONE_MISMATCH));
      }

      // Create phone number value object
      const phoneNumber = PhoneNumber.create(input.phoneNumber);

      // Check if user already exists
      const exists = await this.userRepository.exists(phoneNumber);

      if (exists) {
        return failure(new DuplicateError('User', 'phone number'));
      }

      // Hash password
      const hashedPassword = await this.passwordHasher.hash(input.password);

      // Create user entity
      const user = User.create({
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        phoneNumber,
        password: hashedPassword,
        language: input.language || 'ru',
        consentGivenAt: new Date(),
      });

      // Save user
      const savedUser = await this.userRepository.save(user);

      return success(savedUser);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
