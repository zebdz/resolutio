/** ArchiveBoard application flow decodes request identities before domain/repository use.
 * Authorization and persistence stay coordinated here; lifecycle decisions belong to Board. */
import { z } from 'zod';
import { Clock } from '../shared/EntityCreation';
import { BoardId, UserId } from '@/domain/shared/EntityIds';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { BoardErrors, BoardUseCaseError } from './BoardErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

/** Raw request values, decoded once at the application boundary. */
export interface ArchiveBoardInput {
  boardId: string;
  adminUserId: string;
}

const request = z.object({
  boardId: BoardId,
  adminUserId: UserId,
});

export interface ArchiveBoardDependencies {
  clock: Clock;
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ArchiveBoardUseCase {
  private clock: Clock;
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;

  constructor(dependencies: ArchiveBoardDependencies) {
    this.clock = dependencies.clock;
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
  }

  async execute(
    rawInput: ArchiveBoardInput
  ): Promise<Result<void, BoardUseCaseError>> {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = decoded.data;

    // Find the board
    const board = await this.boardRepository.findById(input.boardId);

    if (!board) {
      return failure(BoardErrors.NOT_FOUND);
    }

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(
      input.adminUserId
    );

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        input.adminUserId,
        board.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // Archive the board
    const archiveResult = board.archive(this.clock.now());

    if (!archiveResult.success) {
      return failure(archiveResult.error);
    }

    // Save the updated board
    await this.boardRepository.update(board);

    return success(undefined);
  }
}
