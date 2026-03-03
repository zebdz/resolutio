import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../RegisterUserUseCase';
import { OtpErrors } from '../OtpErrors';
import { AuthErrors } from '../AuthErrors';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { PasswordHasher } from '../RegisterUserUseCase';
import { DuplicateError } from '@/domain/shared/errors';

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private nextId = 1;

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByIds(): Promise<User[]> {
    return [];
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    return (
      Array.from(this.users.values()).find((u) =>
        u.phoneNumber.equals(phoneNumber)
      ) || null
    );
  }

  async save(user: User): Promise<User> {
    const id = `user-${this.nextId++}`;
    (user as any).props.id = id;
    this.users.set(id, user);

    return user;
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    return Array.from(this.users.values()).some((u) =>
      u.phoneNumber.equals(phoneNumber)
    );
  }

  async searchUsers(): Promise<User[]> {
    return [];
  }

  async isSuperAdmin(): Promise<boolean> {
    return false;
  }
}

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();

  async save(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  async findLatestByIdentifier(): Promise<OtpVerification | null> {
    return null;
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(): Promise<number> {
    return 0;
  }

  async countRecentByIdentifier(): Promise<number> {
    return 0;
  }

  async deleteExpired(): Promise<void> {}

  addOtp(otp: OtpVerification): void {
    this.otps.set(otp.id, otp);
  }
}

// Mock PasswordHasher
class MockPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed-${password}`;
  }
}

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepository: MockUserRepository;
  let otpRepository: MockOtpRepository;
  let passwordHasher: MockPasswordHasher;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    otpRepository = new MockOtpRepository();
    passwordHasher = new MockPasswordHasher();

    useCase = new RegisterUserUseCase(
      userRepository,
      passwordHasher,
      otpRepository
    );
  });

  const validInput = {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+79161234567',
    password: 'securepass',
    otpId: 'otp-1',
    language: 'ru' as const,
    consentGiven: true,
  };

  it('should fail when consentGiven is false', async () => {
    const result = await useCase.execute({
      ...validInput,
      consentGiven: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.message).toBe(AuthErrors.CONSENT_NOT_GIVEN);
    }
  });

  it('should fail when OTP not found', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.message).toBe(OtpErrors.NOT_VERIFIED);
    }
  });

  it('should fail when OTP not verified', async () => {
    const otp = OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: '+79161234567',
      channel: 'sms',
      code: 'hashed-code',
      clientIp: '127.0.0.1',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: null,
      createdAt: new Date(),
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.message).toBe(OtpErrors.NOT_VERIFIED);
    }
  });

  it('should fail when OTP phone does not match registration phone', async () => {
    const otp = OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: '+79169999999', // different phone
      channel: 'sms',
      code: 'hashed-code',
      clientIp: '127.0.0.1',
      attempts: 1,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
      createdAt: new Date(),
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.message).toBe(OtpErrors.PHONE_MISMATCH);
    }
  });

  it('should create user when OTP is verified and phone matches', async () => {
    const otp = OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: '+79161234567',
      channel: 'sms',
      code: 'hashed-code',
      clientIp: '127.0.0.1',
      attempts: 1,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
      createdAt: new Date(),
    });
    otpRepository.addOtp(otp);

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.firstName).toBe('John');
      expect(result.value.lastName).toBe('Doe');
      expect(result.value.phoneNumber.getValue()).toBe('+79161234567');
      expect(result.value.consentGivenAt).toBeInstanceOf(Date);
    }
  });

  it('should fail when user with phone already exists', async () => {
    // Add verified OTP
    const otp = OtpVerification.reconstitute({
      id: 'otp-1',
      identifier: '+79161234567',
      channel: 'sms',
      code: 'hashed-code',
      clientIp: '127.0.0.1',
      attempts: 1,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
      createdAt: new Date(),
    });
    otpRepository.addOtp(otp);

    // Create user first time
    await useCase.execute(validInput);

    // Try again with new OTP for same phone
    const otp2 = OtpVerification.reconstitute({
      id: 'otp-2',
      identifier: '+79161234567',
      channel: 'sms',
      code: 'hashed-code',
      clientIp: '127.0.0.1',
      attempts: 1,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      verifiedAt: new Date(),
      createdAt: new Date(),
    });
    otpRepository.addOtp(otp2);

    const result = await useCase.execute({
      ...validInput,
      otpId: 'otp-2',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(DuplicateError);
    }
  });
});
