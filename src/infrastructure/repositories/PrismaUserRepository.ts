import type { UserRepository } from '@/domain/user/UserRepository';
import { User, type Language } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import type { PrismaClient } from '@/generated/prisma/client';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  phoneNumber: true,
  password: true,
  language: true,
  consentGivenAt: true,
  createdAt: true,
  nickname: true,
  allowFindByName: true,
  allowFindByPhone: true,
  privacySetupCompleted: true,
  confirmedAt: true,
} as const;

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: USER_SELECT,
    });

    return users.map((user) => this.toDomain(user));
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: phoneNumber.getValue() },
      select: USER_SELECT,
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByNickname(nickname: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { nickname },
      select: USER_SELECT,
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { nickname },
    });

    return count === 0;
  }

  async save(user: User): Promise<User> {
    const savedUser = await this.prisma.user.upsert({
      where: { id: user.id || 'new-user' }, // Use a non-existent ID for new users
      create: {
        // Don't include id - let Prisma generate it
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
        language: user.language,
        consentGivenAt: user.consentGivenAt,
        createdAt: user.createdAt,
        nickname: user.nickname.getValue(),
        allowFindByName: user.allowFindByName,
        allowFindByPhone: user.allowFindByPhone,
        privacySetupCompleted: user.privacySetupCompleted,
        confirmedAt: user.confirmedAt,
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
        language: user.language,
        nickname: user.nickname.getValue(),
      },
      select: USER_SELECT,
    });

    // Return the reconstituted user with the actual ID from database
    return this.toDomain(savedUser);
  }

  async updatePrivacySettings(user: User): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          allowFindByName: user.allowFindByName,
          allowFindByPhone: user.allowFindByPhone,
          privacySetupCompleted: user.privacySetupCompleted,
          nickname: user.nickname.getValue(),
        },
      }),
      this.prisma.userPrivacyAuditLog.create({
        data: {
          userId: user.id,
          allowFindByName: user.allowFindByName,
          allowFindByPhone: user.allowFindByPhone,
        },
      }),
    ]);
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { phoneNumber: phoneNumber.getValue() },
    });

    return count > 0;
  }

  async searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean }
  ): Promise<User[]> {
    const respectPrivacy = options?.respectPrivacy ?? false;

    // Name-based search conditions (respects allowFindByName when privacy is on)
    const nameConditions = [
      { firstName: { contains: query, mode: 'insensitive' as const } },
      { lastName: { contains: query, mode: 'insensitive' as const } },
      { middleName: { contains: query, mode: 'insensitive' as const } },
    ];

    // Nickname is always searchable regardless of privacy settings
    const nicknameCondition = {
      nickname: { contains: query, mode: 'insensitive' as const },
    };

    let where;

    if (respectPrivacy) {
      // Users findable by name (opted in) OR by nickname (always)
      where = {
        OR: [
          {
            AND: [{ allowFindByName: true }, { OR: nameConditions }],
          },
          nicknameCondition,
        ],
      };
    } else {
      // No privacy filter — search all by name or nickname
      where = {
        OR: [...nameConditions, nicknameCondition],
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: USER_SELECT,
      take: 20,
    });

    return users.map((user) => this.toDomain(user));
  }

  async searchUserByPhone(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        phoneNumber: phone,
        allowFindByPhone: true,
      },
      select: USER_SELECT,
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { userId },
    });

    return superAdmin !== null;
  }

  async confirmUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { confirmedAt: new Date() },
    });
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    const latest = await this.prisma.userBlockStatus.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    return latest?.status === 'blocked';
  }

  async blockUser(
    userId: string,
    superadminId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.userBlockStatus.create({
      data: {
        userId,
        status: 'blocked',
        statusChangedBySuperadminId: superadminId,
        reason,
      },
    });
  }

  async unblockUser(
    userId: string,
    superadminId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.userBlockStatus.create({
      data: {
        userId,
        status: 'unblocked',
        statusChangedBySuperadminId: superadminId,
        reason,
      },
    });
  }

  async getBlockStatus(
    userId: string
  ): Promise<{ blocked: boolean; reason?: string; blockedAt?: Date } | null> {
    const latest = await this.prisma.userBlockStatus.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, reason: true, createdAt: true },
    });

    if (!latest) {
      return null;
    }

    if (latest.status === 'blocked') {
      return {
        blocked: true,
        reason: latest.reason ?? undefined,
        blockedAt: latest.createdAt,
      };
    }

    return { blocked: false };
  }

  private toDomain(user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phoneNumber: string;
    password: string;
    language: string;
    consentGivenAt: Date | null;
    createdAt: Date;
    nickname: string;
    allowFindByName: boolean;
    allowFindByPhone: boolean;
    privacySetupCompleted: boolean;
    confirmedAt: Date | null;
  }): User {
    // PhoneNumber.create throws if invalid, which is correct here
    // because database should always have valid phone numbers
    const phoneNumber = PhoneNumber.create(user.phoneNumber);

    return User.reconstitute({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName ?? undefined,
      phoneNumber: phoneNumber,
      password: user.password,
      language: (user.language as Language) || 'ru',
      consentGivenAt: user.consentGivenAt ?? undefined,
      createdAt: user.createdAt,
      nickname: Nickname.create(user.nickname),
      allowFindByName: user.allowFindByName,
      allowFindByPhone: user.allowFindByPhone,
      privacySetupCompleted: user.privacySetupCompleted,
      confirmedAt: user.confirmedAt ?? undefined,
    });
  }

  async getBlockedUserIds(): Promise<string[]> {
    const result = await this.prisma.$queryRaw<{ user_id: string }[]>`
      SELECT user_id FROM (
        SELECT DISTINCT ON (user_id) user_id, status
        FROM user_block_statuses
        ORDER BY user_id, created_at DESC
      ) latest
      WHERE status = 'blocked'
    `;

    return result.map((r) => r.user_id);
  }
}
