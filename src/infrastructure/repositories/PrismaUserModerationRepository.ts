/** Append-only moderation adapter validates stored history and returns explicit failures.
 * Historical empty/null reasons are preserved; query exceptions stay at the I/O boundary. */
import { z } from 'zod';
import type { PrismaClient } from '@/generated/prisma/client';
import { UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { failure, success } from '@/domain/shared/Result';
import {
  UserBlockEntryId,
  UserModerationEntry,
  UserModerationReasonSnapshot,
  UserModerationStatus,
} from '@/domain/user/UserModeration';
import type { UserModerationRepository } from '@/domain/user/UserModerationRepository';
import { FirstName, LastName, MiddleName } from '@/domain/user/UserValues';

const storedInstant = z
  .date()
  .transform((value) => value.toISOString())
  .pipe(Instant.schema);
const statusRow = z.object({
  status: UserModerationStatus,
  reason: UserModerationReasonSnapshot.nullable(),
  createdAt: storedInstant,
});
const historyRow = statusRow.extend({
  id: UserBlockEntryId,
  statusChangedBy: z.object({
    firstName: FirstName,
    lastName: LastName,
    middleName: MiddleName.nullable(),
  }),
});
export class PrismaUserModerationRepository implements UserModerationRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async getStatuses(
    userIds: readonly UserId[]
  ): ReturnType<UserModerationRepository['getStatuses']> {
    if (userIds.length === 0) {
      return success(new Map());
    }

    let rows;

    try {
      rows = await this.prisma.userBlockStatus.findMany({
        where: { userId: { in: [...userIds] } },
        orderBy: { createdAt: 'desc' },
        distinct: ['userId'],
        select: { userId: true, status: true, reason: true, createdAt: true },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    const parsed = z
      .array(statusRow.extend({ userId: UserId }))
      .safeParse(rows);

    if (!parsed.success) {
      return failure('common.errors.unexpected');
    }

    return success(
      new Map(
        parsed.data.map((row) => [
          row.userId,
          row.status === 'blocked'
            ? {
                blocked: true,
                reason: row.reason ?? undefined,
                blockedAt: row.createdAt,
              }
            : { blocked: false },
        ])
      )
    );
  }
  async getBlockedUserIds(): ReturnType<
    UserModerationRepository['getBlockedUserIds']
  > {
    let rows;

    try {
      rows = await this.prisma.$queryRaw<{ user_id: string; status: string }[]>`
        SELECT DISTINCT ON (user_id) user_id, status
        FROM user_block_statuses
        ORDER BY user_id, created_at DESC
      `;
    } catch {
      return failure('common.errors.unexpected');
    }

    const parsed = z
      .array(z.object({ user_id: UserId, status: UserModerationStatus }))
      .safeParse(rows);

    return parsed.success
      ? success(
          parsed.data
            .filter((row) => row.status === 'blocked')
            .map((row) => row.user_id)
        )
      : failure('common.errors.unexpected');
  }
  async append(
    input: UserModerationEntry
  ): ReturnType<UserModerationRepository['append']> {
    const entry = UserModerationEntry.safeParse(input);

    if (!entry.success) {
      return failure('common.errors.unexpected');
    }

    try {
      await this.prisma.userBlockStatus.create({
        data: {
          id: entry.data.id,
          userId: entry.data.userId,
          status: entry.data.status,
          statusChangedBySuperadminId: entry.data.actorId,
          reason: entry.data.reason,
          createdAt: Instant.toDate(entry.data.createdAt),
        },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }
  async getStatus(
    userId: UserId
  ): ReturnType<UserModerationRepository['getStatus']> {
    let row;

    try {
      row = await this.prisma.userBlockStatus.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, reason: true, createdAt: true },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    if (row === null) {
      return success(null);
    }

    const parsed = statusRow.safeParse(row);

    if (!parsed.success) {
      return failure('common.errors.unexpected');
    }

    return success(
      parsed.data.status === 'blocked'
        ? {
            blocked: true,
            reason: parsed.data.reason ?? undefined,
            blockedAt: parsed.data.createdAt,
          }
        : { blocked: false }
    );
  }
  async getHistory(
    userId: UserId
  ): ReturnType<UserModerationRepository['getHistory']> {
    let rows;

    try {
      rows = await this.prisma.userBlockStatus.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          reason: true,
          createdAt: true,
          statusChangedBy: {
            select: { firstName: true, lastName: true, middleName: true },
          },
        },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    const parsed = z.array(historyRow).safeParse(rows);

    return parsed.success
      ? success(parsed.data)
      : failure('common.errors.unexpected');
  }
}
