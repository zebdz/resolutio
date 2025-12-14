import { Board, BoardProps } from '../../domain/board/Board';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { PrismaClient } from '@prisma/client';

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

    return !!membership;
  }

  async addUserToBoard(userId: string, boardId: string): Promise<void> {
    await this.prisma.boardUser.create({
      data: {
        boardId,
        userId,
      },
    });
  }

  async removeUserFromBoard(userId: string, boardId: string): Promise<void> {
    await this.prisma.boardUser.delete({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
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
