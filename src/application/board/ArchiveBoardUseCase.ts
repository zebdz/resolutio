import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors } from './BoardErrors';

export interface ArchiveBoardInput {
  boardId: string;
  adminUserId: string;
}

export interface ArchiveBoardDependencies {
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
}

export class ArchiveBoardUseCase {
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;

  constructor(dependencies: ArchiveBoardDependencies) {
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
  }

  async execute(input: ArchiveBoardInput): Promise<Result<void, string>> {
    // Find the board
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    // Cannot archive the general board
    if (board.isGeneral) {
      return failure(BoardErrors.CANNOT_ARCHIVE_GENERAL);
    }

    // Check if user is an admin of the organization
    const isAdmin = await this.organizationRepository.isUserAdmin(
      input.adminUserId,
      board.organizationId
    );

    if (!isAdmin) {
      return failure('organization.errors.notAdmin');
    }

    // Archive the board
    const archiveResult = board.archive();

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    // Save the updated board
    await this.boardRepository.update(board);

    return success(undefined);
  }
}
