/** Verifies Register User behavior through typed core ports.
 * User persistence doubles exclude obsolete moderation methods; access uses the checked moderation port. */
import { PasswordHash } from '@/domain/user/UserValues';
import {
  OtpCount,
  OtpDestination,
  OtpDigits,
  OtpCodeHash,
} from '@/domain/otp/OtpValues';
import { authTestDependencies } from '@/application/auth/__tests__/authTestValues';
/** Registration clients provide deterministic identity, time and nickname ports. */
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { NicknameGenerator } from '../NicknameGenerator';
import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUserUseCase } from '../RegisterUserUseCase';
import { SESSION_TTL_MS } from '../LoginUserUseCase';
import { RegisterUserSchema } from '../RegisterUserSchema';
import { AuthErrors } from '../AuthErrors';
import { OtpErrors } from '../OtpErrors';
import { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { Address } from '@/domain/user/Address';
import { OtpRepository } from '@/domain/otp/OtpRepository';
import {
  OtpVerification,
  OtpChannel,
  OtpPurposes,
  OtpPurpose,
} from '@/domain/otp/OtpVerification';
import { EmailAddress } from '@/domain/user/EmailAddress';
import { PasswordHasher } from '../RegisterUserUseCase';
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { OtpCodeHasher } from '../OtpCodeHasher';
import { OtpDeliveryChannel, OtpDeliveryResult } from '../OtpDeliveryChannel';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

const registrationNow = Instant.parse('2026-10-26T10:30:00.123Z');

function creationDependencies() {
  let nextId = 1;
  let nextNickname = 1;
  const ids: IdGenerator = {
    generate: (identity) => identity.parse(`user-${nextId++}`),
  };
  const clock: Clock = { now: () => registrationNow };
  const nicknameGenerator: NicknameGenerator = {
    generate: () =>
      Nickname.create(`user_${(nextNickname++).toString(16).padStart(8, '0')}`),
  };

  return { ids, clock, nicknameGenerator };
}

// Mock UserRepository
class MockUserRepository implements UserRepository {
  private users: Map<UserId, User> = new Map();
  nicknameAvailableResponses: boolean[] = [];
  isNicknameAvailableCalls: string[] = [];

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByIds(): Promise<User[]> {
    return [];
  }

  async findByEmail(email: EmailAddress): Promise<User | null> {
    return (
      Array.from(this.users.values()).find(
        (u) => u.email?.getValue() === email.getValue()
      ) || null
    );
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

  async isNicknameAvailable(nickname: Nickname): Promise<boolean> {
    this.isNicknameAvailableCalls.push(nickname.getValue());

    if (this.nicknameAvailableResponses.length > 0) {
      return this.nicknameAvailableResponses.shift()!;
    }

    return true;
  }

  async updatePrivacySettings(): Promise<void> {}

  async deleteAddress(): Promise<void> {}
}

// Mock OtpRepository
class MockOtpRepository implements OtpRepository {
  private otps: Map<string, OtpVerification> = new Map();
  private nextId = 1;

  get saved(): OtpVerification[] {
    return Array.from(this.otps.values());
  }

  async save(otp: OtpVerification): Promise<OtpVerification> {
    const id = otp.id;
    this.otps.set(id, otp);

    return otp;
  }

  async findById(id: string): Promise<OtpVerification | null> {
    return this.otps.get(id) || null;
  }

  seed(otp: OtpVerification): void {
    this.otps.set(otp.id, otp);
  }

  async findLatestByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    const { identifier, channel } = destination;

    return this.latest(
      (o) =>
        o.identifier === identifier &&
        o.channel === channel &&
        o.purpose === purpose
    );
  }

  async findLatestByUserId(
    userId: string,
    purpose: OtpPurpose
  ): Promise<OtpVerification | null> {
    return this.latest((o) => o.userId === userId && o.purpose === purpose);
  }

  async update(otp: OtpVerification): Promise<OtpVerification> {
    this.otps.set(otp.id, otp);

    return otp;
  }

  async countRecentByClientIp(): Promise<OtpCount> {
    return OtpCount.parse(0);
  }

  async countRecentByIdentifier(
    destination: OtpDestination,
    purpose: OtpPurpose,
    cutoff: Instant
  ): Promise<OtpCount> {
    const { identifier, channel } = destination;
    const since = Instant.toDate(cutoff).getTime();

    return OtpCount.parse(
      Array.from(this.otps.values()).filter(
        (o) =>
          o.identifier === identifier &&
          o.channel === channel &&
          o.purpose === purpose &&
          Instant.toDate(o.createdAt).getTime() >= since
      ).length
    );
  }

  async deleteAllForUser(): Promise<OtpCount> {
    return OtpCount.parse(0);
  }

  async deleteExpired(): Promise<void> {}

  private latest(
    match: (o: OtpVerification) => boolean
  ): OtpVerification | null {
    const matches = Array.from(this.otps.values())
      .filter(match)
      .sort(
        (a, b) =>
          Instant.toDate(b.createdAt).getTime() -
          Instant.toDate(a.createdAt).getTime()
      );

    return matches[0] ?? null;
  }
}

// Mock SessionRepository
class MockSessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();
  private nextId = 1;
  deletedUserSessions: string[] = [];

  async save(session: Session): Promise<Session> {
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
  async hash(password: string): Promise<PasswordHash> {
    return PasswordHash.parse(`hashed-${password}`);
  }
}

// Mock OtpCodeHasher
class MockOtpCodeHasher implements OtpCodeHasher {
  hash(code: OtpDigits): OtpCodeHash {
    return OtpCodeHash.parse(`hashed-${code}`);
  }

  verify(code: string, hash: string): boolean {
    return `hashed-${code}` === hash;
  }
}

// Mock OtpDeliveryChannel
class MockOtpDeliveryChannel<
  C extends OtpChannel,
> implements OtpDeliveryChannel<C> {
  constructor(readonly channel: C) {}
  shouldSucceed = true;
  sendCount = 0;
  lastSentCode: string | null = null;

  async send(
    ...[_recipient, code, _locale, _clientIp]: Parameters<
      OtpDeliveryChannel<C>['send']
    >
  ): Promise<OtpDeliveryResult> {
    this.sendCount += 1;
    this.lastSentCode = code;

    if (!this.shouldSucceed) {
      return { success: false };
    }

    return { success: true };
  }
}

// An account that registered earlier with the same phone and never confirmed.
function unconfirmedExisting(): User {
  return User.reconstitute({
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
}

// A phone-confirmation code issued to that account some minutes ago, valid
// for ten minutes from issue.
function phoneCodeFor(
  userId: string,
  overrides: Partial<{ id: string; issuedMinutesAgo: number }> = {}
): OtpVerification {
  const createdAt = new Date(
    Date.now() - (overrides.issuedMinutesAgo ?? 1) * 60 * 1000
  );

  return OtpVerification.reconstitute({
    id: overrides.id ?? 'otp-seeded',
    identifier: '+79161234567',
    channel: 'sms',
    purpose: OtpPurposes.PHONE_CONFIRMATION,
    code: 'hashed-123456',
    clientIp: '127.0.0.1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000),
    verifiedAt: null,
    createdAt,
    userId,
  });
}

describe('RegisterUserUseCase', () => {
  let useCase: RegisterUserUseCase;
  let userRepository: MockUserRepository;
  let otpRepository: MockOtpRepository;
  let sessionRepository: MockSessionRepository;
  let passwordHasher: MockPasswordHasher;
  let otpCodeHasher: MockOtpCodeHasher;
  let deliveryChannel: MockOtpDeliveryChannel<'sms'>;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    otpRepository = new MockOtpRepository();
    sessionRepository = new MockSessionRepository();
    passwordHasher = new MockPasswordHasher();
    otpCodeHasher = new MockOtpCodeHasher();
    deliveryChannel = new MockOtpDeliveryChannel('sms');

    useCase = new RegisterUserUseCase({
      ...authTestDependencies(),
      ...creationDependencies(),
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

  it('uses supplied identity and time before saving a newly registered user', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.id).toBe('user-1');
      expect(result.value.user.createdAt).toBe(registrationNow);
      expect(result.value.user.consentGivenAt).toBe(registrationNow);
    }
  });

  it('should fail when clientIp is empty and not create a session', async () => {
    const result = await useCase.execute({
      ...validInput,
      clientIp: '',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.MISSING_IP);
    }

    // No session should have been created
    expect(await sessionRepository.findById('session-1')).toBeNull();
  });

  it('should fail when consentGiven is false', async () => {
    const result = await useCase.execute({
      ...validInput,
      consentGiven: false,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(AuthErrors.CONSENT_NOT_GIVEN);
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
      expect(result.value.user.consentGivenAt).toBe(registrationNow);
      expect(result.value.session).toBeDefined();
      expect(result.value.session.userId).toBe(result.value.user.id);
    }

    const phoneCodes = otpRepository.saved.filter(
      (o) => o.purpose === OtpPurposes.PHONE_CONFIRMATION
    );
    expect(phoneCodes).toHaveLength(1);
    expect(deliveryChannel.sendCount).toBe(1);
  });

  it('gives the session cookie the session TTL, not the OTP expiry', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.sessionExpiresInSeconds).toBe(SESSION_TTL_MS / 1000);
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
      expect(result.error).toBe(AuthErrors.PHONE_EXISTS);
    }
  });

  it('should re-register unconfirmed user: invalidate sessions + update data + send OTP', async () => {
    userRepository.addUser(unconfirmedExisting());

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
    }

    // OTP sent
    expect(deliveryChannel.sendCount).toBe(1);
  });

  it('preserves the existing address and privacy choice when registration details change', async () => {
    const address = Address.create({
      country: 'Russia',
      city: 'Moscow',
      street: 'Main',
      building: '1',
      isPrivateHouse: true,
    });
    userRepository.addUser(
      unconfirmedExisting()
        .updateAddress(address)
        .updatePrivacySettings({ allowFindByAddress: true })
    );

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.address?.equals(address)).toBe(true);
      expect(result.value.user.allowFindByAddress).toBe(true);
    }
  });

  // Same rule as login: re-registering an unconfirmed phone must not pump SMS.
  it('does not send a new code when the re-registered phone still has a pending one', async () => {
    userRepository.addUser(unconfirmedExisting());
    otpRepository.seed(phoneCodeFor('existing-user'));

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);
    expect(deliveryChannel.sendCount).toBe(0);
    expect(otpRepository.saved).toHaveLength(1);
  });

  it('does not send while the throttle from earlier codes still runs', async () => {
    userRepository.addUser(unconfirmedExisting());
    // Three codes in the window put the next one 30 minutes out; the last
    // expired a minute ago, so nothing is pending either.
    otpRepository.seed(
      phoneCodeFor('existing-user', { id: 'otp-a', issuedMinutesAgo: 13 })
    );
    otpRepository.seed(
      phoneCodeFor('existing-user', { id: 'otp-b', issuedMinutesAgo: 12 })
    );
    otpRepository.seed(
      phoneCodeFor('existing-user', { id: 'otp-c', issuedMinutesAgo: 11 })
    );

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);
    expect(deliveryChannel.sendCount).toBe(0);
    expect(otpRepository.saved).toHaveLength(3);
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
      expect(result.error).toBe(OtpErrors.SEND_FAILED);
    }
  });

  it('should hash the OTP code before saving', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      const savedOtp = otpRepository.saved.find(
        (o) => o.purpose === OtpPurposes.PHONE_CONFIRMATION
      );
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

describe('RegisterUserUseCase with an email address', () => {
  let useCase: RegisterUserUseCase;
  let userRepository: MockUserRepository;
  let otpRepository: MockOtpRepository;
  let sessionRepository: MockSessionRepository;
  let passwordHasher: MockPasswordHasher;
  let otpCodeHasher: MockOtpCodeHasher;
  let smsChannel: MockOtpDeliveryChannel<'sms'>;
  let emailChannel: MockOtpDeliveryChannel<'email'>;

  const validInput = {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+79161234567',
    password: 'securepass',
    language: 'ru' as const,
    consentGiven: true,
    clientIp: '127.0.0.1',
  };

  beforeEach(() => {
    userRepository = new MockUserRepository();
    otpRepository = new MockOtpRepository();
    sessionRepository = new MockSessionRepository();
    passwordHasher = new MockPasswordHasher();
    otpCodeHasher = new MockOtpCodeHasher();
    smsChannel = new MockOtpDeliveryChannel('sms');
    emailChannel = new MockOtpDeliveryChannel('email');

    useCase = new RegisterUserUseCase({
      ...authTestDependencies(),
      ...creationDependencies(),
      userRepository,
      passwordHasher,
      otpRepository,
      sessionRepository,
      otpCodeHasher,
      deliveryChannel: smsChannel,
      emailDeliveryChannel: emailChannel,
    });
  });

  it('stores the address unconfirmed and normalized', async () => {
    const result = await useCase.execute({
      ...validInput,
      email: 'John@Mail.RU',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.email?.getValue()).toBe('john@mail.ru');
      expect(result.value.user.hasConfirmedEmail()).toBe(false);
    }
  });

  it('issues an email_confirmation code alongside the phone code', async () => {
    await useCase.execute({ ...validInput, email: 'john@mail.ru' });

    const purposes = otpRepository.saved.map((o) => o.purpose);

    expect(purposes).toContain(OtpPurposes.PHONE_CONFIRMATION);
    expect(purposes).toContain(OtpPurposes.EMAIL_CONFIRMATION);
  });

  it('sends the email code to the address, not the phone', async () => {
    await useCase.execute({ ...validInput, email: 'john@mail.ru' });

    const emailOtp = otpRepository.saved.find(
      (o) => o.purpose === OtpPurposes.EMAIL_CONFIRMATION
    );

    expect(emailOtp?.identifier).toBe('john@mail.ru');
    expect(emailOtp?.channel).toBe('email');
  });

  it('registers normally when no email is given', async () => {
    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.email).toBeUndefined();
    }

    const purposes = otpRepository.saved.map((o) => o.purpose);
    expect(purposes).not.toContain(OtpPurposes.EMAIL_CONFIRMATION);
  });

  it('treats an empty email string as no email', async () => {
    const result = await useCase.execute({ ...validInput, email: '' });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.user.email).toBeUndefined();
    }
  });

  it('rejects an invalid address', async () => {
    const result = await useCase.execute({
      ...validInput,
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_INVALID);
    }
  });

  it('rejects an address already used by another account', async () => {
    const existing = User.reconstitute({
      id: 'user-99',
      firstName: 'Petr',
      lastName: 'Petrov',
      phoneNumber: PhoneNumber.create('+79997654321'),
      password: 'hash',
      language: 'ru',
      createdAt: new Date('2026-01-01'),
      nickname: Nickname.create('petr_petrov'),
    }).changeEmail(EmailAddress.create('john@mail.ru'));
    userRepository.addUser(existing);

    const result = await useCase.execute({
      ...validInput,
      email: 'john@mail.ru',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(UserDomainCodes.EMAIL_TAKEN);
    }
  });

  // Registration must not die because a mail server is down; the phone flow is
  // what actually gates the account.
  it('still registers when the confirmation email cannot be sent', async () => {
    emailChannel.shouldSucceed = false;

    const result = await useCase.execute({
      ...validInput,
      email: 'john@mail.ru',
    });

    expect(result.success).toBe(true);
  });
});

describe('RegisterUserSchema — password vs. the supplied email', () => {
  const base = {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+79161234567',
    language: 'ru' as const,
    consentGiven: true as const,
  };

  it.each([
    ['the full address', 'ivan.petrov@mail.ru'],
    ['the local part', 'ivan.petrov'],
  ])('rejects a password equal to %s', (_label, password) => {
    const result = RegisterUserSchema.safeParse({
      ...base,
      email: 'ivan.petrov@mail.ru',
      password,
      confirmPassword: password,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.message === UserDomainCodes.PASSWORD_MATCHES_PERSONAL_INFO
        )
      ).toBe(true);
    }
  });

  it('accepts an unrelated password alongside an email', () => {
    const result = RegisterUserSchema.safeParse({
      ...base,
      email: 'ivan.petrov@mail.ru',
      password: 'Korova-Zabor-71',
      confirmPassword: 'Korova-Zabor-71',
    });

    expect(result.success).toBe(true);
  });

  it('still accepts a password that merely contains the local part', () => {
    const result = RegisterUserSchema.safeParse({
      ...base,
      email: 'ivan@mail.ru',
      password: 'ivan-Korova-Zabor-71',
      confirmPassword: 'ivan-Korova-Zabor-71',
    });

    expect(result.success).toBe(true);
  });
});
