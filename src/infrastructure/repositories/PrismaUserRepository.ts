import type { UserRepository } from '@/domain/user/UserRepository';
import { User, type Language } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import type { PrismaClient } from '@/generated/prisma/client';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        password: true,
        language: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByIds(ids: string[]): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        password: true,
        language: true,
        createdAt: true,
      },
    });

    return users.map((user) => this.toDomain(user));
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: phoneNumber.getValue() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        password: true,
        language: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
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
        createdAt: user.createdAt,
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
        language: user.language,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        password: true,
        language: true,
        createdAt: true,
      },
    });

    // Return the reconstituted user with the actual ID from database
    return this.toDomain(savedUser);
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { phoneNumber: phoneNumber.getValue() },
    });

    return count > 0;
  }

  async searchUsers(query: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { middleName: { contains: query, mode: 'insensitive' } },
          { phoneNumber: { contains: query } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phoneNumber: true,
        password: true,
        language: true,
        createdAt: true,
      },
      take: 20, // Limit results to 20 users
    });

    return users.map((user) => this.toDomain(user));
  }

  private toDomain(user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phoneNumber: string;
    password: string;
    language: string;
    createdAt: Date;
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
      createdAt: user.createdAt,
    });
  }
}
