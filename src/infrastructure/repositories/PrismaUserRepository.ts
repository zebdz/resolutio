import type { UserRepository } from '@/domain/user/UserRepository';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import type { PrismaClient } from '@prisma/client';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: phoneNumber.getValue() },
    });

    if (!user) {
      return null;
    }

    return this.toDomain(user);
  }

  async save(user: User): Promise<User> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
        createdAt: user.createdAt,
      },
      update: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber.getValue(),
        password: user.password,
      },
    });

    return user;
  }

  async exists(phoneNumber: PhoneNumber): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { phoneNumber: phoneNumber.getValue() },
    });

    return count > 0;
  }

  private toDomain(user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phoneNumber: string;
    password: string;
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
      createdAt: user.createdAt,
    });
  }
}
