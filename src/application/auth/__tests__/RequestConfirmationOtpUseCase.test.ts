import { describe, it, expect, beforeEach } from 'vitest';
import { RequestConfirmationOtpUseCase } from '../RequestConfirmationOtpUseCase';
import { OtpErrors } from '../OtpErrors';
import { AuthErrors } from '../AuthErrors';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { OtpDeliveryChannel, OtpDeliveryResult } from '../OtpDeliveryChannel';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();
  private nextId = 1;

  async save(otp: OtpVerification): Promise<OtpVerification> {
    const id = `otp-${this.nextId++}`;
    (otp as any).props.id = id;
    this.otps.set(id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  async findLatestByIdentifier(
    identifier: string,
    channel: OtpChannel
  ): Promise<OtpVerification | null> {
    const all = Array.from(this.otps.values()).filter(
      (o) => o.identifier === identifier && o.channel === channel
    );

    if (all.length === 0) {
      return null;
    }

    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(): Promise<number> {
    return 0;
  }

  async countRecentByIdentifier(
    identifier: string,
    channel: OtpChannel,
    sinceHours: number
  ): Promise<number> {
    const since = new Date(Date.now() - sinceHours * 3600 * 1000);

    return Array.from(this.otps.values()).filter(
      (o) =>
        o.identifier === identifier &&
        o.channel === channel &&
        o.createdAt >= since
    ).length;
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

// Mock OtpDeliveryChannel
class MockOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'sms';
  shouldSucceed = true;
  returnBackdoorCode = true;
  lastSentCode: string | null = null;

  async send(
    _recipient: string,
    code: string,
    _locale: string,
    _clientIp: string
  ): Promise<OtpDeliveryResult> {
    this.lastSentCode = code;

    if (!this.shouldSucceed) {
      return { success: false };
    }

    return {
      success: true,
      backdoorCode: this.returnBackdoorCode ? code : undefined,
    };
  }
}

// Mock UserRepository (minimal)
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async confirmUser(): Promise<void> {}
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
  async deleteAddress(): Promise<void> {}
  async getBlockedUserIds(): Promise<string[]> {
    return [];
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

describe('RequestConfirmationOtpUseCase', () => {
  let useCase: RequestConfirmationOtpUseCase;
  let otpRepository: MockOtpRepository;
  let otpCodeHasher: MockOtpCodeHasher;
  let deliveryChannel: MockOtpDeliveryChannel;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    otpRepository = new MockOtpRepository();
    otpCodeHasher = new MockOtpCodeHasher();
    deliveryChannel = new MockOtpDeliveryChannel();
    userRepository = new MockUserRepository();

    useCase = new RequestConfirmationOtpUseCase({
      otpRepository,
      otpCodeHasher,
      deliveryChannel,
      userRepository,
    });
  });

  it('should fail when clientIp is empty', async () => {
    userRepository.addUser(makeUser());

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.MISSING_IP);
    }
  });

  it('should fail when user not found', async () => {
    const result = await useCase.execute({
      userId: 'nonexistent',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.NOT_FOUND);
    }
  });

  it('should succeed and return otpId + expiresAt + backdoorCode', async () => {
    userRepository.addUser(makeUser());

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.otpId).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.backdoorCode).toBeTruthy();
    }
  });

  it('should not return backdoorCode when delivery channel omits it', async () => {
    userRepository.addUser(makeUser());
    deliveryChannel.returnBackdoorCode = false;

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.backdoorCode).toBeUndefined();
    }
  });

  it('should use per-phone throttle (countRecentByIdentifier)', async () => {
    userRepository.addUser(makeUser());

    // First request succeeds
    const result1 = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });
    expect(result1.success).toBe(true);

    // Second request should be throttled (per-phone, not per-IP)
    const result2 = await useCase.execute({
      userId: 'user-1',
      clientIp: '1.2.3.4', // different IP
    });
    expect(result2.success).toBe(false);

    if (!result2.success) {
      expect(result2.error).toBe(OtpErrors.THROTTLED);
    }
  });

  it('should fail when delivery channel fails', async () => {
    userRepository.addUser(makeUser());
    deliveryChannel.shouldSucceed = false;

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OtpErrors.SEND_FAILED);
    }
  });

  it('should save OTP with userId', async () => {
    userRepository.addUser(makeUser());

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const savedOtp = await otpRepository.findById(result.value.otpId);
      expect(savedOtp!.userId).toBe('user-1');
    }
  });

  it('should hash the code before saving', async () => {
    userRepository.addUser(makeUser());

    const result = await useCase.execute({
      userId: 'user-1',
      clientIp: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const savedOtp = await otpRepository.findById(result.value.otpId);
      expect(savedOtp!.code).toMatch(/^hashed-/);
    }
  });
});
