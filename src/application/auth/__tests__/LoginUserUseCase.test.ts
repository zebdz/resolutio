import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LoginUserUseCase,
  PasswordVerifier,
  SESSION_TTL_MS,
  SUPERADMIN_SESSION_TTL_MS,
} from '../LoginUserUseCase';
import { UserRepository } from '@/domain/user/UserRepository';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { UnauthorizedError } from '@/domain/shared/errors';
import { Nickname } from '@/domain/user/Nickname';

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

// Mock SessionRepository
class MockSessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  lastCreatedExpiresAt: Date | null = null;

  async create(userId: string, expiresAt: Date): Promise<Session> {
    const session: Session = {
      id: `session-${Date.now()}`,
      userId,
      expiresAt,
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.lastCreatedExpiresAt = expiresAt;

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

function createTestUser(overrides: Partial<{ id: string }> = {}): User {
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
  });
}

describe('LoginUserUseCase', () => {
  let useCase: LoginUserUseCase;
  let userRepository: MockUserRepository;
  let sessionRepository: MockSessionRepository;
  let passwordVerifier: MockPasswordVerifier;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    sessionRepository = new MockSessionRepository();
    passwordVerifier = new MockPasswordVerifier();
    useCase = new LoginUserUseCase(
      userRepository,
      sessionRepository,
      passwordVerifier
    );
  });

  it('should reject invalid credentials (user not found)', async () => {
    const result = await useCase.execute({
      phoneNumber: '+79161234567',
      password: 'wrongpass',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
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
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
  });

  it('should give regular user a 30-day session', async () => {
    const user = createTestUser();
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

  it('should give superadmin an 8-hour session', async () => {
    const user = createTestUser();
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
});
