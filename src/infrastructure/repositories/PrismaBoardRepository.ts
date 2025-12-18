import { PrismaClient } from '@/generated/prisma/client';
import { Board } from '../../domain/board/Board';
import { BoardRepository } from '../../domain/board/BoardRepository';

export class PrismaBoardRepository implements BoardRepository {
  constructor(private prisma: PrismaClient) {}

  async save(board: Board): Promise<Board> {
    const data = board.toJSON();

    const created = await this.prisma.board.create({
      data: {
        name: data.name,
        organizationId: data.organizationId,
        isGeneral: data.isGeneral,
        createdAt: data.createdAt,
        archivedAt: data.archivedAt,
      },
    });

    return Board.reconstitute({
      id: created.id,
      name: created.name,
      organizationId: created.organizationId,
      isGeneral: created.isGeneral,
      createdAt: created.createdAt,
      archivedAt: created.archivedAt,
    });
  }

  async findById(id: string): Promise<Board | null> {
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
      isGeneral: board.isGeneral,
      createdAt: board.createdAt,
      archivedAt: board.archivedAt,
    });
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    const boards = await this.prisma.board.findMany({
      where: { organizationId },
    });

    return boards.map((board) =>
      Board.reconstitute({
        id: board.id,
        name: board.name,
        organizationId: board.organizationId,
        isGeneral: board.isGeneral,
        createdAt: board.createdAt,
        archivedAt: board.archivedAt,
      })
    );
  }

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    const board = await this.prisma.board.findFirst({
      where: {
        organizationId,
        isGeneral: true,
      },
    });

    if (!board) {
      return null;
    }

    return Board.reconstitute({
      id: board.id,
      name: board.name,
      organizationId: board.organizationId,
      isGeneral: board.isGeneral,
      createdAt: board.createdAt,
      archivedAt: board.archivedAt,
    });
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
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
    userId: string,
    boardId: string,
    addedBy?: string
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
    userId: string,
    boardId: string,
    removedBy?: string,
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
      isGeneral: updated.isGeneral,
      createdAt: updated.createdAt,
      archivedAt: updated.archivedAt,
    });
  }
}
