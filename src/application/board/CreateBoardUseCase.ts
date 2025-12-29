import { Board } from '../../domain/board/Board';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface CreateBoardInput {
  name: string;
  organizationId: string;
  adminUserId: string;
  isGeneral?: boolean;
}

export interface CreateBoardDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
}

export class CreateBoardUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;

  constructor(dependencies: CreateBoardDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
  }

  async execute(input: CreateBoardInput): Promise<
    Result<
      {
        board: {
          id: string;
          name: string;
          organizationId: string;
          isGeneral: boolean;
          createdAt: Date;
        };
      },
      string
    >
  > {
    // Check if organization exists
    const organization = await this.organizationRepository.findById(
      input.organizationId
    );

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // Check if user is an admin of the organization
    const isAdmin = await this.organizationRepository.isUserAdmin(
      input.adminUserId,
      input.organizationId
    );

    if (!isAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Create the board entity
    const boardResult = Board.create(
      input.name,
      input.organizationId,
      input.isGeneral || false
    );

    if (!boardResult.success) {
      return failure(boardResult.error);
    }

    // Save the board
    const savedBoard = await this.boardRepository.save(boardResult.value);

    return success({
      board: {
        id: savedBoard.id,
        name: savedBoard.name,
        organizationId: savedBoard.organizationId,
        isGeneral: savedBoard.isGeneral,
        createdAt: savedBoard.createdAt,
      },
    });
  }
}
