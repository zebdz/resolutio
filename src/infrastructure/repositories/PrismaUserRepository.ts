import type { UserRepository } from '@/domain/user/UserRepository';
import { User, type Language } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { Address } from '@/domain/user/Address';
import { EmailAddress } from '@/domain/user/EmailAddress';
import type { PrismaClient } from '@/generated/prisma/client';
import { AddressIntegrityLogger } from '@/infrastructure/address/AddressIntegrityLogger';

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
  allowFindByAddress: true,
  privacySetupCompleted: true,
  confirmedAt: true,
  email: true,
  emailConfirmedAt: true,
  address: {
    select: {
      id: true,
      country: true,
      region: true,
      city: true,
      street: true,
      building: true,
      apartment: true,
      postalCode: true,
      isPrivateHouse: true,
      oneLine: true,
      houseFiasId: true,
      flatFiasId: true,
    },
  },
} as const;

// Shape returned by USER_SELECT, and the input to toDomain /
// toDomainSkippingInvalid. Named so both can share one signature.
type UserRow = {
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
  allowFindByAddress: boolean;
  privacySetupCompleted: boolean;
  confirmedAt: Date | null;
  email: string | null;
  emailConfirmedAt: Date | null;
  address: {
    id: string;
    country: string;
    region: string | null;
    city: string;
    street: string;
    building: string;
    apartment: string | null;
    postalCode: string | null;
    isPrivateHouse: boolean;
    oneLine: string | null;
    houseFiasId: string | null;
    flatFiasId: string | null;
  } | null;
};

export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly addressIntegrityLogger: AddressIntegrityLogger = new AddressIntegrityLogger()
  ) {}

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

    // Deliberately strict, NOT toDomainSkippingInvalid — see that method's
    // doc comment for why this list method must not swallow a bad row.
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

  async findByEmail(email: EmailAddress): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.getValue() },
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
        // `?? null` for the same reason as the address fields below: Prisma
        // skips `undefined`, so removing an email would otherwise leave the
        // old address in place.
        email: user.email?.getValue() ?? null,
        emailConfirmedAt: user.emailConfirmedAt ?? null,
        ...(user.address
          ? {
              // Prisma treats `undefined` in a create/update payload as "skip
              // this column" — only `null` writes NULL. Address.create()
              // normalizes cleared optional fields to `undefined` (see
              // Address.ts), so every optional field below is coalesced with
              // `?? null` before reaching Prisma. Without this, clearing a
              // field in the UI (e.g. postal code, or apartment/flatFiasId
              // when switching to "private house") would silently leave the
              // stale value in the database while the action reports
              // success. Applies to all three field lists in this method
              // (create, upsert.create, upsert.update) — keep them
              // identical; required fields (country/city/street/building)
              // and isPrivateHouse are non-nullable and must NOT be
              // coalesced.
              address: {
                create: {
                  country: user.address.country,
                  region: user.address.region ?? null,
                  city: user.address.city,
                  street: user.address.street,
                  building: user.address.building,
                  apartment: user.address.apartment ?? null,
                  postalCode: user.address.postalCode ?? null,
                  isPrivateHouse: user.address.isPrivateHouse,
                  oneLine: user.address.oneLine ?? null,
                  houseFiasId: user.address.houseFiasId ?? null,
                  flatFiasId: user.address.flatFiasId ?? null,
                },
              },
            }
          : {}),
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
        language: user.language,
        nickname: user.nickname.getValue(),
        email: user.email?.getValue() ?? null,
        emailConfirmedAt: user.emailConfirmedAt ?? null,
        ...(user.address
          ? {
              address: {
                // See the `?? null` comment on the create block above —
                // same reasoning applies to both branches below.
                upsert: {
                  create: {
                    country: user.address.country,
                    region: user.address.region ?? null,
                    city: user.address.city,
                    street: user.address.street,
                    building: user.address.building,
                    apartment: user.address.apartment ?? null,
                    postalCode: user.address.postalCode ?? null,
                    isPrivateHouse: user.address.isPrivateHouse,
                    oneLine: user.address.oneLine ?? null,
                    houseFiasId: user.address.houseFiasId ?? null,
                    flatFiasId: user.address.flatFiasId ?? null,
                  },
                  update: {
                    country: user.address.country,
                    region: user.address.region ?? null,
                    city: user.address.city,
                    street: user.address.street,
                    building: user.address.building,
                    apartment: user.address.apartment ?? null,
                    postalCode: user.address.postalCode ?? null,
                    isPrivateHouse: user.address.isPrivateHouse,
                    oneLine: user.address.oneLine ?? null,
                    houseFiasId: user.address.houseFiasId ?? null,
                    flatFiasId: user.address.flatFiasId ?? null,
                  },
                },
              },
            }
          : {}),
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
          allowFindByAddress: user.allowFindByAddress,
          privacySetupCompleted: user.privacySetupCompleted,
          nickname: user.nickname.getValue(),
        },
      }),
      this.prisma.userPrivacyAuditLog.create({
        data: {
          userId: user.id,
          allowFindByName: user.allowFindByName,
          allowFindByPhone: user.allowFindByPhone,
          allowFindByAddress: user.allowFindByAddress,
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

  async deleteAddress(userId: string): Promise<void> {
    await this.prisma.address.deleteMany({ where: { userId } });
  }

  async searchUsers(
    query: string,
    options?: { respectPrivacy?: boolean; city?: string; street?: string }
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

    // Address-based search conditions (respects allowFindByAddress when privacy is on)
    const addressConditions = [
      {
        address: {
          city: { contains: query, mode: 'insensitive' as const },
        },
      },
      {
        address: {
          street: { contains: query, mode: 'insensitive' as const },
        },
      },
    ];

    if (respectPrivacy) {
      // Users findable by name (opted in) OR by nickname (always) OR by address (opted in)
      where = {
        OR: [
          {
            AND: [{ allowFindByName: true }, { OR: nameConditions }],
          },
          nicknameCondition,
          {
            AND: [{ allowFindByAddress: true }, { OR: addressConditions }],
          },
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

    // Not the strict findByIds path — see toDomainSkippingInvalid's doc
    // comment for why this list method deliberately skips bad rows instead.
    return this.toDomainSkippingInvalid(users, 'searchUsers');
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

  private toDomain(user: UserRow): User {
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
      allowFindByAddress: user.allowFindByAddress,
      privacySetupCompleted: user.privacySetupCompleted,
      confirmedAt: user.confirmedAt ?? undefined,
      email: user.email ? EmailAddress.create(user.email) : undefined,
      emailConfirmedAt: user.emailConfirmedAt ?? undefined,
      address: user.address
        ? Address.create({
            country: user.address.country,
            region: user.address.region ?? undefined,
            city: user.address.city,
            street: user.address.street,
            building: user.address.building,
            apartment: user.address.apartment ?? undefined,
            postalCode: user.address.postalCode ?? undefined,
            isPrivateHouse: user.address.isPrivateHouse,
            oneLine: user.address.oneLine ?? undefined,
            houseFiasId: user.address.houseFiasId ?? undefined,
            flatFiasId: user.address.flatFiasId ?? undefined,
          })
        : undefined,
    });
  }

  /**
   * Same mapping as toDomain, but for a list: one row that fails
   * reconstitution (e.g. Address.create() throwing APARTMENT_REQUIRED for a
   * row written by old code during a deploy write window — see "Accepted
   * risk" in readmes/2026-08-06-address-dadata-design.md) is skipped and
   * logged instead of taking down the entire result set.
   *
   * ONLY wired up for searchUsers. Deliberately NOT used by findByIds, even
   * though both return User[] — this asymmetry is intentional, not an
   * oversight:
   *
   * - findByIds feeds GetPollResultsUseCase to resolve voter names for a
   *   poll's results protocol, which is a legal document. Silently dropping
   *   a participant there would produce an incomplete protocol. This
   *   project's rule is that who voted, when, and in what manner must
   *   always be preserved — a hard error on a bad row is strictly better
   *   than a silently incomplete legal document, so findByIds stays on the
   *   strict `users.map((user) => this.toDomain(user))` path.
   * - searchUsers is a discovery feature. A missing search result is
   *   degraded UX, not a corrupted record, so here it is fine — better,
   *   even — to skip the bad row, log it for an operator to fix, and keep
   *   serving the rest.
   */
  private async toDomainSkippingInvalid(
    users: UserRow[],
    method: string
  ): Promise<User[]> {
    const result: User[] = [];

    for (const user of users) {
      try {
        result.push(this.toDomain(user));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);

        await this.addressIntegrityLogger.logUnreadableAddress({
          userId: user.id,
          reason,
          method,
        });
      }
    }

    return result;
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
