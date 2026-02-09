import { Board } from '../../domain/board/Board';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface CreateBoardInput {
  name: string;
  organizationId: string;
  adminUserId: string;
}

export interface CreateBoardDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class CreateBoardUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: CreateBoardDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(input: CreateBoardInput): Promise<
    Result<
      {
        board: {
          id: string;
          name: string;
          organizationId: string;
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

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.adminUserId
    );

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.adminUserId,
        input.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // Create the board entity
    const boardResult = Board.create(input.name, input.organizationId);

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
        createdAt: savedBoard.createdAt,
      },
    });
  }
}
