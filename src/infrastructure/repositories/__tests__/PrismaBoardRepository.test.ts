/** Board persistence preserves application-assigned identity and validates stored
 * values before returning typed aggregate/projection data. */
import { BoardName } from '@/domain/board/BoardName';
import { describe, expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { Board } from '@/domain/board/Board';
import { BoardId, OrganizationId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { PrismaBoardRepository } from '../PrismaBoardRepository';

describe('PrismaBoardRepository', () => {
  it('rejects invalid stored member identities before returning a projection', async () => {
    const prisma = {
      boardUser: { findMany: vi.fn().mockResolvedValue([{ userId: '' }]) },
    } as unknown as PrismaClient;

    await expect(
      new PrismaBoardRepository(prisma).findBoardMembers(
        BoardId.parse('board-1')
      )
    ).rejects.toThrow();
  });

  it('persists the identity assigned before domain creation', async () => {
    const result = Board.create(
      BoardName.parse('Board'),
      OrganizationId.parse('org-1'),
      {
        id: BoardId.parse('board-application-created'),
        now: Instant.parse('2026-10-26T12:00:00.000Z'),
      }
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    const create = vi.fn(
      async ({ data }: { data: Prisma.BoardCreateInput }) => ({
        ...data,
        id: data.id ?? 'database-generated-id',
      })
    );
    const prisma = { board: { create } } as unknown as PrismaClient;
    const saved = await new PrismaBoardRepository(prisma).save(result.value);

    expect(saved.id).toBe(result.value.id);
    expect(saved.toJSON()).toEqual(result.value.toJSON());
    expect(create).toHaveBeenCalledWith({ data: result.value.toJSON() });
  });
});
