/** Creates a board with application-assigned identity/time after authorization.
 * Request identity/name are decoded before domain use; outputs retain core types. */
import { z } from 'zod';
import { BoardId, OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { BoardUseCaseError } from './BoardErrors';
import { Board } from '../../domain/board/Board';
import { parseBoardName } from '../../domain/board/BoardName';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from '../organization/OrganizationErrors';

/** Raw request/transport values; execute validates IDs before domain use. */
export interface CreateBoardInput {
  name: string;
  organizationId: string;
  adminUserId: string;
}

const request = z.object({
  name: z.string(),
  organizationId: OrganizationId,
  adminUserId: UserId,
});

export interface CreateBoardDependencies {
  ids: IdGenerator;
  clock: Clock;
  boardRepository: BoardRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker?: ProfanityChecker;
}

export class CreateBoardUseCase {
  private ids: IdGenerator;
  private clock: Clock;
  private boardRepository: BoardRepository;
  private organizationRepository: OrganizationRepository;
  private userRepository: UserRepository;
  private profanityChecker?: ProfanityChecker;

  constructor(dependencies: CreateBoardDependencies) {
    this.ids = dependencies.ids;
    this.clock = dependencies.clock;
    this.boardRepository = dependencies.boardRepository;
    this.organizationRepository = dependencies.organizationRepository;
    this.userRepository = dependencies.userRepository;
    this.profanityChecker = dependencies.profanityChecker;
  }

  async execute(rawInput: CreateBoardInput): Promise<
    Result<
      {
        board: Readonly<
          Pick<Board, 'id' | 'name' | 'organizationId' | 'createdAt'>
        >;
      },
      BoardUseCaseError
    >
  > {
    const decoded = request.safeParse(rawInput);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = decoded.data;

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
    const name = parseBoardName(input.name);

    if (!name.success) {
      return name;
    }

    const boardResult = Board.create(
      name.value,
      input.organizationId,
      entityCreation(BoardId, this.ids, this.clock),
      this.profanityChecker
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
        createdAt: savedBoard.createdAt,
      },
    });
  }
}
