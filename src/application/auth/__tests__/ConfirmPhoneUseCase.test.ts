import { describe, it, expect, beforeEach } from 'vitest';
import { ConfirmPhoneUseCase } from '../ConfirmPhoneUseCase';
import { OtpErrors } from '../OtpErrors';
import { AuthErrors } from '../AuthErrors';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();

  addOtp(otp: OtpVerification): void {
    this.otps.set(otp.id, otp);
  }

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
}

// Mock OtpCodeHasher
class MockOtpCodeHasher implements OtpCodeHasher {
  hash(code: string): string {
    return `hashed-${code}`;
  }

  verify(code: string, hash: string): boolean {
    return `hashed-${code}` === hash;
  }
}

// Mock UserRepository (minimal)
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  confirmedUserIds: string[] = [];

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  async confirmUser(userId: string): Promise<void> {
    this.confirmedUserIds.push(userId);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByIds(): Promise<User[]> {
    return [];
  }

  async findByPhoneNumber(): Promise<User | null> {
    return null;
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async save(user: User): Promise<User> {
    return user;
  }

  async updatePrivacySettings(): Promise<void> {}

  async exists(): Promise<boolean> {
    return false;
  }

  async searchUsers(): Promise<User[]> {
    return [];
  }

  async searchUserByPhone(): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(): Promise<boolean> {
    return false;
  }

  async isUserBlocked(): Promise<boolean> {
    return false;
  }

  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}

  async getBlockStatus(): Promise<null> {
    return null;
  }
}

function makeUser(overrides: { id?: string; confirmedAt?: Date } = {}): User {
  return User.reconstitute({
    id: overrides.id ?? 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashed-pass',
    language: 'ru',
    createdAt: new Date('2024-01-01'),
    nickname: Nickname.create('john_doe'),
    confirmedAt: overrides.confirmedAt,
  });
}

function makeOtp(
  overrides: {
    id?: string;
    code?: string;
    userId?: string;
    expiresAt?: Date;
    verifiedAt?: Date | null;
    attempts?: number;
    maxAttempts?: number;
  } = {}
): OtpVerification {
  return OtpVerification.reconstitute({
    id: overrides.id ?? 'otp-1',
    identifier: '+79161234567',
    channel: 'sms',
    code: overrides.code ?? 'hashed-123456',
    clientIp: '127.0.0.1',
    attempts: overrides.attempts ?? 0,
    maxAttempts: overrides.maxAttempts ?? 5,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    verifiedAt: overrides.verifiedAt ?? null,
    createdAt: new Date(),
    userId: overrides.userId,
  });
}

describe('ConfirmPhoneUseCase', () => {
  let useCase: ConfirmPhoneUseCase;
  let otpRepository: MockOtpRepository;
  let otpCodeHasher: MockOtpCodeHasher;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    otpRepository = new MockOtpRepository();
    otpCodeHasher = new MockOtpCodeHasher();
    userRepository = new MockUserRepository();

    useCase = new ConfirmPhoneUseCase({
      otpRepository,
      otpCodeHasher,
      userRepository,
    });
  });

  it('should fail when user not found', async () => {
    otpRepository.addOtp(makeOtp({ userId: 'user-1' }));

    const result = await useCase.execute({
      userId: 'nonexistent',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }
  });

  it('should fail when user already confirmed', async () => {
    const user = makeUser({ confirmedAt: new Date() });
    userRepository.addUser(user);
    otpRepository.addOtp(makeOtp({ userId: 'user-1' }));

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.ACCOUNT_NOT_CONFIRMED);
    }
  });

  it('should fail when OTP not found', async () => {
    const user = makeUser();
    userRepository.addUser(user);

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'nonexistent',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }
  });

  it('should fail when OTP expired', async () => {
    const user = makeUser();
    userRepository.addUser(user);
    otpRepository.addOtp(
      makeOtp({
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
      })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.EXPIRED);
    }
  });

  it('should fail when max attempts reached', async () => {
    const user = makeUser();
    userRepository.addUser(user);
    otpRepository.addOtp(
      makeOtp({ userId: 'user-1', attempts: 5, maxAttempts: 5 })
    );

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.MAX_ATTEMPTS);
    }
  });

  it('should fail when code is invalid', async () => {
    const user = makeUser();
    userRepository.addUser(user);
    otpRepository.addOtp(makeOtp({ userId: 'user-1', code: 'hashed-999999' }));

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.INVALID);
    }
  });

  it('should confirm user on valid code', async () => {
    const user = makeUser();
    userRepository.addUser(user);
    otpRepository.addOtp(makeOtp({ userId: 'user-1', code: 'hashed-123456' }));

    const result = await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    expect(result.success).toBe(true);
    expect(userRepository.confirmedUserIds).toContain('user-1');
  });

  it('should mark OTP as verified on success', async () => {
    const user = makeUser();
    userRepository.addUser(user);
    otpRepository.addOtp(makeOtp({ userId: 'user-1', code: 'hashed-123456' }));

    await useCase.execute({
      userId: 'user-1',
      otpId: 'otp-1',
      code: '123456',
    });

    const otp = await otpRepository.findById('otp-1');
    expect(otp!.isVerified()).toBe(true);
  });
});
