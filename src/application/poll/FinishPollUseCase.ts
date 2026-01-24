import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';

interface FinishPollCommand {
  pollId: string;
  userId: string; // Admin user finishing the poll
}

export class FinishPollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private draftRepository: DraftRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(command: FinishPollCommand): Promise<Result<void, string>> {
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

    // Mark poll as finished
    const finishResult = poll.finish();
    if (!finishResult.success) {
      return failure(finishResult.error);
    }

    // Save the finished poll
    const updateResult = await this.pollRepository.updatePoll(poll);
    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // Clean up all remaining drafts for this poll
    const deleteDraftsResult = await this.draftRepository.deleteAllPollDrafts(
      command.pollId
    );

    if (!deleteDraftsResult.success) {
      // Log error but don't fail the operation
      console.error('Failed to delete poll drafts:', deleteDraftsResult.error);
    }

    return success(undefined);
  }
}
