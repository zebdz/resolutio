import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../RegisterUserUseCase';
import { RegisterUserSchema } from '../RegisterUserSchema';
import { AuthErrors } from '../AuthErrors';
import { OtpErrors } from '../OtpErrors';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import { OtpVerification, OtpChannel } from '@/domain/otp/OtpVerification';
import { PasswordHasher } from '../RegisterUserUseCase';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { OtpDeliveryChannel, OtpDeliveryResult } from '../OtpDeliveryChannel';
import { DuplicateError } from '@/domain/shared/errors';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<string, User> = new Map();
  private nextId = 1;
  nicknameAvailableResponses: boolean[] = [];
  isNicknameAvailableCalls: string[] = [];

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

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
    if (!user.id) {
      const id = `user-${this.nextId++}`;
      (user as any).props.id = id;
    }

    this.users.set(user.id, user);

    return user;
  }

  async confirmUser(): Promise<void> {}

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
  async isUserBlocked(): Promise<boolean> {
    return false;
  }
  async blockUser(): Promise<void> {}
  async unblockUser(): Promise<void> {}
  async getBlockStatus(): Promise<null> {
    return null;
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

// Mock SessionRepository
class MockSessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  private nextId = 1;
  deletedUserSessions: string[] = [];

  async create(
    userId: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const session: Session = {
      id: `session-${this.nextId++}`,
      userId,
      expiresAt,
      createdAt: new Date(),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    };
    this.sessions.set(session.id, session);

    return session;
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    this.deletedUserSessions.push(userId);

    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }
}

// Mock PasswordHasher
class MockPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed-${password}`;
  }
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
  lastSentCode: string | null = null;

  async send(
    _recipient: string,
    code: string,
    _locale: string
  ): Promise<OtpDeliveryResult> {
    this.lastSentCode = code;

    if (!this.shouldSucceed) {
      return { success: false };
    }

    return { success: true, backdoorCode: code };
  }
}

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepository: MockUserRepository;
  let otpRepository: MockOtpRepository;
  let sessionRepository: MockSessionRepository;
  let passwordHasher: MockPasswordHasher;
  let otpCodeHasher: MockOtpCodeHasher;
  let deliveryChannel: MockOtpDeliveryChannel;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    otpRepository = new MockOtpRepository();
    sessionRepository = new MockSessionRepository();
    passwordHasher = new MockPasswordHasher();
    otpCodeHasher = new MockOtpCodeHasher();
    deliveryChannel = new MockOtpDeliveryChannel();

    useCase = new RegisterUserUseCase({
      userRepository,
      passwordHasher,
      otpRepository,
      sessionRepository,
      otpCodeHasher,
      deliveryChannel,
    });
  });

  const validInput = {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+79161234567',
    password: 'securepass',
    language: 'ru' as const,
    consentGiven: true,
    clientIp: '127.0.0.1',
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

  it('should create unconfirmed user + session + send OTP', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.firstName).toBe('John');
      expect(result.value.user.lastName).toBe('Doe');
      expect(result.value.user.phoneNumber.getValue()).toBe('+79161234567');
      expect(result.value.user.isConfirmed()).toBe(false);
      expect(result.value.user.consentGivenAt).toBeInstanceOf(Date);
      expect(result.value.session).toBeDefined();
      expect(result.value.session.userId).toBe(result.value.user.id);
      expect(result.value.otpId).toBeTruthy();
      expect(result.value.expiresAt).toBeInstanceOf(Date);
      expect(result.value.backdoorCode).toBeTruthy();
      expect(result.value.expiresInSeconds).toBeGreaterThan(0);
    }
  });

  it('should fail when confirmed user with phone already exists', async () => {
    const existing = User.reconstitute({
      id: 'existing-user',
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hashed-oldpass',
      language: 'ru',
      createdAt: new Date('2024-01-01'),
      nickname: Nickname.create('jane_doe'),
      confirmedAt: new Date('2024-01-01'),
    });
    userRepository.addUser(existing);

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(DuplicateError);
    }
  });

  it('should re-register unconfirmed user: invalidate sessions + update data + send OTP', async () => {
    const existing = User.reconstitute({
      id: 'existing-user',
      firstName: 'Jane',
      lastName: 'Smith',
      phoneNumber: PhoneNumber.create('+79161234567'),
      password: 'hashed-oldpass',
      language: 'ru',
      createdAt: new Date('2024-01-01'),
      nickname: Nickname.create('jane_smith'),
      // no confirmedAt → unconfirmed
    });
    userRepository.addUser(existing);

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      // Old sessions invalidated
      expect(sessionRepository.deletedUserSessions).toContain('existing-user');
      // User data updated
      expect(result.value.user.firstName).toBe('John');
      expect(result.value.user.lastName).toBe('Doe');
      expect(result.value.user.id).toBe('existing-user');
      // Session created
      expect(result.value.session.userId).toBe('existing-user');
      // OTP sent
      expect(result.value.otpId).toBeTruthy();
    }
  });

  it('should create user with a random nickname', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      const nickname = result.value.user.nickname.getValue();
      expect(nickname).toMatch(/^user_[a-f0-9]{8}$/);
    }

    expect(userRepository.isNicknameAvailableCalls.length).toBe(1);
  });

  it('should retry nickname generation when taken', async () => {
    userRepository.nicknameAvailableResponses = [false, false, true];

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);
    expect(userRepository.isNicknameAvailableCalls.length).toBe(3);
  });

  it('should create user with privacy defaults set to false', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.allowFindByName).toBe(false);
      expect(result.value.user.allowFindByPhone).toBe(false);
      expect(result.value.user.privacySetupCompleted).toBe(false);
    }
  });

  it('should fail when OTP delivery fails', async () => {
    deliveryChannel.shouldSucceed = false;

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.message).toBe(OtpErrors.SEND_FAILED);
    }
  });

  it('should hash the OTP code before saving', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      const savedOtp = await otpRepository.findById(result.value.otpId);
      expect(savedOtp!.code).toMatch(/^hashed-/);
      expect(savedOtp!.userId).toBe(result.value.user.id);
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
