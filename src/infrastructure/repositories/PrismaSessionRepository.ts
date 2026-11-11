/** Maps complete session state to Prisma without generating tokens or choosing time. */
import { SessionRepository, Session } from '@/domain/user/SessionRepository';
import { SessionId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { PrismaClient } from '@/generated/prisma/client';

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(session: Session): Promise<Session> {
    const saved = await this.prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        expiresAt: Instant.toDate(session.expiresAt),
        createdAt: Instant.toDate(session.createdAt),
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    return Session.reconstitute(saved);
  }

  async findById(id: SessionId): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({ where: { id } });

    return row ? Session.reconstitute(row) : null;
  }

  async delete(id: SessionId): Promise<void> {
    await this.prisma.session.delete({ where: { id } });
  }

  async deleteAllForUser(userId: UserId): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
