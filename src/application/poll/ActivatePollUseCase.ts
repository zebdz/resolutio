import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { NotifyPollActivatedUseCase } from '../notification/NotifyPollActivatedUseCase';
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
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private notificationRepository: NotificationRepository,
    private participantRepository: ParticipantRepository,
    private boardRepository: BoardRepository
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

    // Notify participants
    const notifyUseCase = new NotifyPollActivatedUseCase({
      notificationRepository: this.notificationRepository,
      participantRepository: this.participantRepository,
    });
    await notifyUseCase
      .execute({ pollId: poll.id, pollTitle: poll.title })
      .catch((err) => {
        console.error('Failed to send poll activated notifications:', err);
      });

    return success(undefined);
  }
}
