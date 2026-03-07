import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RegisterUserUseCase } from '../RegisterUserUseCase';
import { RegisterUserSchema } from '../RegisterUserSchema';
import { OtpErrors } from '../OtpErrors';
import { AuthErrors } from '../AuthErrors';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { PasswordHasher } from '../RegisterUserUseCase';
import { DuplicateError } from '@/domain/shared/errors';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private nextId = 1;
  nicknameAvailableResponses: boolean[] = [];
  isNicknameAvailableCalls: string[] = [];

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

  async searchUserByPhone(_phone: string): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(): Promise<boolean> {
    return false;
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    this.isNicknameAvailableCalls.push(nickname);

    if (this.nicknameAvailableResponses.length > 0) {
      return this.nicknameAvailableResponses.shift()!;
    }

    return true;
  }

  async updatePrivacySettings(): Promise<void> {}
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

  it('should create user with a random nickname', async () => {
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
      const nickname = result.value.nickname.getValue();
      expect(nickname).toMatch(/^user_[a-f0-9]{8}$/);
    }

    expect(userRepository.isNicknameAvailableCalls.length).toBe(1);
  });

  it('should retry nickname generation when taken', async () => {
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

    // First 2 nicknames taken, third available
    userRepository.nicknameAvailableResponses = [false, false, true];

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);
    // Should have checked 3 times (2 taken + 1 available)
    expect(userRepository.isNicknameAvailableCalls.length).toBe(3);
  });

  it('should create user with privacy defaults set to false', async () => {
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
      expect(result.value.allowFindByName).toBe(false);
      expect(result.value.allowFindByPhone).toBe(false);
      expect(result.value.privacySetupCompleted).toBe(false);
    }
  });
});

describe('RegisterUserSchema', () => {
  const validSchemaInput = {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+79161234567',
    password: 'securepass',
    confirmPassword: 'securepass',
    language: 'ru' as const,
    otpId: 'otp-1',
    consentGiven: true as const,
  };

  it('should reject password matching firstName (case-insensitive)', () => {
    const result = RegisterUserSchema.safeParse({
      ...validSchemaInput,
      firstName: 'Johnjohn',
      password: 'johnjohn',
      confirmPassword: 'johnjohn',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const pwError = result.error.issues.find((i) =>
        i.path.includes('password')
      );
      expect(pwError?.message).toBe(
        UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO
      );
    }
  });

  it('should reject password matching lastName', () => {
    const result = RegisterUserSchema.safeParse({
      ...validSchemaInput,
      lastName: 'Doe',
      password: 'Doe12345',
      confirmPassword: 'Doe12345',
    });
    // This should pass — "Doe12345" != "Doe"
    expect(result.success).toBe(true);

    const result2 = RegisterUserSchema.safeParse({
      ...validSchemaInput,
      lastName: 'Doeville',
      password: 'doeville',
      confirmPassword: 'doeville',
    });
    expect(result2.success).toBe(false);
  });

  it('should reject password matching phoneNumber', () => {
    const result = RegisterUserSchema.safeParse({
      ...validSchemaInput,
      password: '+79161234567',
      confirmPassword: '+79161234567',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const pwError = result.error.issues.find((i) =>
        i.path.includes('password')
      );
      expect(pwError?.message).toBe(
        UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO
      );
    }
  });

  it('should accept valid password not matching personal info', () => {
    const result = RegisterUserSchema.safeParse(validSchemaInput);
    expect(result.success).toBe(true);
  });
});
