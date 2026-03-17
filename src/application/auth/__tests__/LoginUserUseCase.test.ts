import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LoginUserUseCase,
  PasswordVerifier,
  SESSION_TTL_MS,
  SUPERADMIN_SESSION_TTL_MS,
} from '../LoginUserUseCase';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { OtpDeliveryChannel, OtpDeliveryResult } from '../OtpDeliveryChannel';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { AuthErrors } from '../AuthErrors';

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private superAdminIds: Set<string> = new Set();

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
    this.users.set(user.id, user);

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

  async searchUserByPhone(): Promise<User | null> {
    return null;
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdminIds.has(userId);
  }

  async findByNickname(): Promise<User | null> {
    return null;
  }

  async isNicknameAvailable(): Promise<boolean> {
    return true;
  }

  async updatePrivacySettings(): Promise<void> {}

  async isUserBlocked(): Promise<boolean> {
    return false;
  }

  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}

  async confirmUser(): Promise<void> {}

  async getBlockStatus(): Promise<null> {
    return null;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  setSuperAdmin(userId: string): void {
    this.superAdminIds.add(userId);
  }
}

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

// Mock OtpDeliveryChannel
class MockOtpDeliveryChannel implements OtpDeliveryChannel {
  channel: OtpChannel = 'sms';
  shouldSucceed = true;

  async send(
    _recipient: string,
    code: string,
    _locale: string
  ): Promise<OtpDeliveryResult> {
    if (!this.shouldSucceed) {
      return { success: false };
    }

    return { success: true, backdoorCode: code };
  }
}

// Mock SessionRepository
class MockSessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  lastCreatedExpiresAt: Date | null = null;
  lastCreatedIpAddress: string | null = null;
  lastCreatedUserAgent: string | null = null;

  async create(
    userId: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const session: Session = {
      id: `session-${Date.now()}`,
      userId,
      expiresAt,
      createdAt: new Date(),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    };
    this.sessions.set(session.id, session);
    this.lastCreatedExpiresAt = expiresAt;
    this.lastCreatedIpAddress = ipAddress ?? null;
    this.lastCreatedUserAgent = userAgent ?? null;

    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }
}

// Mock PasswordVerifier
class MockPasswordVerifier implements PasswordVerifier {
  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hashed-${password}`;
  }
}

function createTestUser(
  overrides: Partial<{ id: string; confirmedAt: Date }> = {}
): User {
  return User.reconstitute({
    id: overrides.id || 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: PhoneNumber.create('+79161234567'),
    password: 'hashed-securepass',
    language: 'ru',
    nickname: Nickname.create('user_abc12345'),
    allowFindByName: false,
    allowFindByPhone: false,
    privacySetupCompleted: false,
    consentGivenAt: new Date(),
    createdAt: new Date(),
    confirmedAt: overrides.confirmedAt,
  });
}

describe('LoginUserUseCase', () => {
  let useCase: LoginUserUseCase;
  let userRepository: MockUserRepository;
  let sessionRepository: MockSessionRepository;
  let passwordVerifier: MockPasswordVerifier;
  let otpRepository: MockOtpRepository;
  let otpCodeHasher: MockOtpCodeHasher;
  let deliveryChannel: MockOtpDeliveryChannel;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    sessionRepository = new MockSessionRepository();
    passwordVerifier = new MockPasswordVerifier();
    otpRepository = new MockOtpRepository();
    otpCodeHasher = new MockOtpCodeHasher();
    deliveryChannel = new MockOtpDeliveryChannel();
    useCase = new LoginUserUseCase({
      userRepository,
      sessionRepository,
      passwordVerifier,
      otpRepository,
      otpCodeHasher,
      deliveryChannel,
    });
  });

  it('should reject invalid credentials (user not found)', async () => {
    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'wrongpass',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.INVALID_CREDENTIALS);
    }
  });

  it('should reject invalid credentials (wrong password)', async () => {
    const user = createTestUser();
    userRepository.addUser(user);

    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'wrongpass',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.INVALID_CREDENTIALS);
    }
  });

  it('should give regular user a 1-day session', async () => {
    const user = createTestUser({ confirmedAt: new Date() });
    userRepository.addUser(user);

    const before = Date.now();
    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'securepass',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const expiresAt = sessionRepository.lastCreatedExpiresAt!;
      const ttl = expiresAt.getTime() - before;
      // Should be ~30 days (allow 5s tolerance)
      expect(ttl).toBeGreaterThanOrEqual(SESSION_TTL_MS - 5000);
      expect(ttl).toBeLessThanOrEqual(SESSION_TTL_MS + 5000);
      expect(result.value.expiresInSeconds).toBeCloseTo(
        SESSION_TTL_MS / 1000,
        -1
      );
    }
  });

  it('should give superadmin a 4-hour session', async () => {
    const user = createTestUser({ confirmedAt: new Date() });
    userRepository.addUser(user);
    userRepository.setSuperAdmin(user.id);

    const before = Date.now();
    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'securepass',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const expiresAt = sessionRepository.lastCreatedExpiresAt!;
      const ttl = expiresAt.getTime() - before;
      // Should be ~8 hours (allow 5s tolerance)
      expect(ttl).toBeGreaterThanOrEqual(SUPERADMIN_SESSION_TTL_MS - 5000);
      expect(ttl).toBeLessThanOrEqual(SUPERADMIN_SESSION_TTL_MS + 5000);
      expect(result.value.expiresInSeconds).toBeCloseTo(
        SUPERADMIN_SESSION_TTL_MS / 1000,
        -1
      );
    }
  });

  it('should forward IP address and user-agent to session repository', async () => {
    const user = createTestUser({ confirmedAt: new Date() });
    userRepository.addUser(user);

    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'securepass',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(true);
    expect(sessionRepository.lastCreatedIpAddress).toBe('192.168.1.1');
    expect(sessionRepository.lastCreatedUserAgent).toBe('Mozilla/5.0');
  });

  it('should return needsConfirmation for unconfirmed user', async () => {
    const user = createTestUser(); // no confirmedAt
    userRepository.addUser(user);

    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'securepass',
      ipAddress: '127.0.0.1',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.needsConfirmation).toBe(true);
      expect(result.value.session).toBeDefined();
      expect(result.value.otpId).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.backdoorCode).toBeTruthy();
    }
  });

  it('should not set needsConfirmation for confirmed user', async () => {
    const user = createTestUser({ confirmedAt: new Date() });
    userRepository.addUser(user);

    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'securepass',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.needsConfirmation).toBeUndefined();
      expect(result.value.otpId).toBeUndefined();
    }
  });
});
