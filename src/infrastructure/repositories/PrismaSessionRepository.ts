import type {
  SessionRepository,
  Session,
} from '@/domain/user/SessionRepository';
import type { PrismaClient } from '@prisma/client';

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, expiresAt: Date): Promise<Session> {
    const session = await this.prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  async findById(id: string): Promise<Session | null> {
    const session = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }
}
