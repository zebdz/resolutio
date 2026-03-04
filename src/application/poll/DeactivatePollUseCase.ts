import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';

interface DeactivatePollCommand {
  pollId: string;
  userId: string; // Admin user deactivating the poll
}

export class DeactivatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private boardRepository: BoardRepository
  ) {}

  async execute(command: DeactivatePollCommand): Promise<Result<void, string>> {
    // Get the poll
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
      const isAdmin = await this.organizationRepository.isUserAdmin(
        command.userId,
        poll.organizationId
      );

      if (!isAdmin) {
        return failure(PollErrors.NOT_AUTHORIZED);
      }
    }

    // Check if organization is archived
    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (organization?.isArchived()) {
      return failure(PollErrors.ORGANIZATION_ARCHIVED);
    }

    // Check if board is archived (for board-specific polls)
    if (poll.boardId) {
      const board = await this.boardRepository.findById(poll.boardId);

      if (board?.isArchived()) {
        return failure(PollErrors.BOARD_ARCHIVED);
      }
    }

    // Deactivate the poll
    const deactivateResult = poll.deactivate();

    if (!deactivateResult.success) {
      return failure(deactivateResult.error);
    }

    // Save the updated poll
    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
