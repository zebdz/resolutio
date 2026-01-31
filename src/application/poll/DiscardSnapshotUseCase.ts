import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';

interface DiscardSnapshotCommand {
  pollId: string;
  userId: string;
}

/**
 * Discards a participant snapshot (READY → DRAFT).
 * Only allowed if no votes have been cast.
 */
export class DiscardSnapshotUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    command: DiscardSnapshotCommand
  ): Promise<Result<void, string>> {
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

    // Check if poll has votes
    const hasVotesResult = await this.voteRepository.pollHasVotes(
      command.pollId
    );

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    const hasVotes = hasVotesResult.value;

    // Discard snapshot (validates state and votes)
    const discardResult = poll.discardSnapshot(hasVotes);

    if (!discardResult.success) {
      return failure(discardResult.error);
    }

    // Delete all participants for this poll
    const deleteResult =
      await this.participantRepository.deleteParticipantsByPollId(
        command.pollId
      );

    if (!deleteResult.success) {
      return failure(deleteResult.error);
    }

    // Update the poll
    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
