/** Poll application boundary validates requests, invokes domain behavior and
 * preserves known failure codes across authorization and persistence ports. */
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { PollSnapshotTransaction } from './PollSnapshotTransaction';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { UserId } from '@/domain/shared/EntityIds';
import { PollId } from '@/domain/poll/PollValues';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

interface DiscardSnapshotCommand {
  pollId: string;
  userId: string;
}

/**
 * Discards a participant snapshot (READY → SUBMITTED).
 * Invokes domain behavior against locked, fresh inputs and explicitly persists
 * the transition and participant removal in one transaction.
 */
export class DiscardSnapshotUseCase {
  constructor(
    private pollRepository: PollRepository,
    private snapshotTransaction: PollSnapshotTransaction,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private boardRepository: BoardRepository
  ) {}

  async execute(
    command: DiscardSnapshotCommand
  ): Promise<Result<void, PollUseCaseFailure>> {
    const pollId = PollId.safeParse(command.pollId);

    if (!pollId.success) {
      return failure(PollDomainCodes.POLL_INVALID_ID);
    }

    const actor = UserId.safeParse(command.userId);

    if (!actor.success) {
      return failure('common.errors.validationFailed');
    }

    const pollResult = await this.pollRepository.getPollById(pollId.data);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(actor.data);

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        actor.data,
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

    // Check if board is archived
    if (poll.boardId) {
      const board = await this.boardRepository.findById(poll.boardId);

      if (board?.isArchived()) {
        return failure(PollErrors.BOARD_ARCHIVED);
      }
    }

    return this.snapshotTransaction.withLockedPoll(
      pollId.data,
      async (snapshot) => {
        // Read vote presence under the same lock as the lifecycle transition.
        const hasVotes = await snapshot.hasVotes();
        // Discard snapshot (validates state and votes).
        const discardResult = snapshot.poll.discardSnapshot(hasVotes);

        if (!discardResult.success) {
          return discardResult;
        }

        // Save the transition and discard its participant snapshot atomically.
        await snapshot.savePoll();
        await snapshot.removeParticipantSnapshot();

        return success(undefined);
      }
    );
  }
}
