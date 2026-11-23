/** Maps validated board aggregates and typed identity projections to Prisma.
 * Persistence retains IDs assigned before creation and decodes all returned values. */
import { PrismaClient } from '@/generated/prisma/client';
import { Board } from '../../domain/board/Board';
import { BoardName } from '../../domain/board/BoardName';
import { BoardId, OrganizationId, UserId } from '../../domain/shared/EntityIds';
import {
  BoardRepository,
  BoardSummary,
} from '../../domain/board/BoardRepository';

export class PrismaBoardRepository implements BoardRepository {
  constructor(private prisma: PrismaClient) {}

  async save(board: Board): Promise<Board> {
    const data = board.toJSON();

    const created = await this.prisma.board.create({
      data: {
        id: data.id,
        name: data.name,
        organizationId: data.organizationId,
        createdAt: data.createdAt,
        archivedAt: data.archivedAt,
      },
    });

    return Board.reconstitute({
      id: created.id,
      name: created.name,
      organizationId: created.organizationId,
      createdAt: created.createdAt,
      archivedAt: created.archivedAt,
    });
  }

  async findById(id: BoardId): Promise<Board | null> {
    const board = await this.prisma.board.findUnique({
      where: { id },
    });

    if (!board) {
      return null;
    }

    return Board.reconstitute({
      id: board.id,
      name: board.name,
      organizationId: board.organizationId,
      createdAt: board.createdAt,
      archivedAt: board.archivedAt,
    });
  }

  async findByOrganizationId(organizationId: OrganizationId): Promise<Board[]> {
    const boards = await this.prisma.board.findMany({
      where: { organizationId },
    });

    return boards.map((board) =>
      Board.reconstitute({
        id: board.id,
        name: board.name,
        organizationId: board.organizationId,
        createdAt: board.createdAt,
        archivedAt: board.archivedAt,
      })
    );
  }

  async findBoardMembers(boardId: BoardId): Promise<{ userId: UserId }[]> {
    const members = await this.prisma.boardUser.findMany({
      where: {
        boardId,
        removedAt: null,
      },
      select: {
        userId: true,
      },
    });

    return members.map((member) => ({ userId: UserId.parse(member.userId) }));
  }

  async isUserMember(userId: UserId, boardId: BoardId): Promise<boolean> {
    const membership = await this.prisma.boardUser.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    // User is a member only if they exist and haven't been removed
    return !!membership && !membership.removedAt;
  }

  async addUserToBoard(
    userId: UserId,
    boardId: BoardId,
    addedBy?: UserId
  ): Promise<void> {
    // Check if user was previously a member (and removed)
    const existingMembership = await this.prisma.boardUser.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    if (existingMembership) {
      // If the user was previously removed, update the record to add them back
      if (existingMembership.removedAt) {
        await this.prisma.boardUser.update({
          where: {
            boardId_userId: {
              boardId,
              userId,
            },
          },
          data: {
            addedBy,
            addedAt: new Date(),
            removedAt: null,
            removedBy: null,
            removedReason: null,
          },
        });
      }
      // If user is already an active member, do nothing
    } else {
      // Create new membership
      await this.prisma.boardUser.create({
        data: {
          boardId,
          userId,
          addedBy,
          addedAt: new Date(),
        },
      });
    }
  }

  async removeUserFromBoard(
    userId: UserId,
    boardId: BoardId,
    removedBy?: UserId,
    removedReason?: string
  ): Promise<void> {
    await this.prisma.boardUser.update({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
      data: {
        removedAt: new Date(),
        removedBy,
        removedReason,
      },
    });
  }

  async findActiveBoardsByUserId(userId: UserId): Promise<BoardSummary[]> {
    const boards = await this.prisma.board.findMany({
      where: {
        archivedAt: null,
        members: {
          some: {
            userId,
            removedAt: null,
          },
        },
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
      },
      orderBy: { name: 'asc' },
    });

    return boards.map((board) => ({
      id: BoardId.parse(board.id),
      name: BoardName.parse(board.name),
      organizationId: OrganizationId.parse(board.organizationId),
    }));
  }

  async update(board: Board): Promise<Board> {
    const data = board.toJSON();

    const updated = await this.prisma.board.update({
      where: { id: data.id },
      data: {
        name: data.name,
        archivedAt: data.archivedAt,
      },
    });

    return Board.reconstitute({
      id: updated.id,
      name: updated.name,
      organizationId: updated.organizationId,
      createdAt: updated.createdAt,
      archivedAt: updated.archivedAt,
    });
  }
}
