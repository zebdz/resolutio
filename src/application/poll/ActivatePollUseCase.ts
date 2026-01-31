import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';

interface ActivatePollCommand {
  pollId: string;
  userId: string;
}

/**
 * Activates a poll (READY → ACTIVE).
 * Poll must have a snapshot taken first via TakeSnapshotUseCase.
 */
export class ActivatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(command: ActivatePollCommand): Promise<Result<void, string>> {
    const pollResult = await this.pollRepository.getPollById(command.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(command.userId);

    if (!isSuperAdmin) {
      const board = await this.boardRepository.findById(poll.boardId);

      if (!board) {
        return failure(PollErrors.BOARD_NOT_FOUND);
      }

      const isAdmin = await this.organizationRepository.isUserAdmin(
        command.userId,
        board.organizationId
      );

      if (!isAdmin) {
        return failure(PollErrors.NOT_AUTHORIZED);
      }
    }

    // Activate the poll (READY → ACTIVE)
    const activateResult = poll.activate();

    if (!activateResult.success) {
      return failure(activateResult.error);
    }

    // Update the poll
    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
