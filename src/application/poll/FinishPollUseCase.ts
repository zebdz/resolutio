/** Authorizes finishing with a validated cutoff instant, commits through the guarded
 * repository, then performs cleanup/notifications without undoing the cutoff. */
import { Clock, IdGenerator } from '../shared/EntityCreation';
import { PollInstant } from '../../domain/poll/PollValues';
import { z } from 'zod';
import { PollId, UserId } from '../../domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { NotifyPollFinishedUseCase } from '../notification/NotifyPollFinishedUseCase';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

interface FinishPollCommand {
  pollId: string;
  userId: string; // Admin user finishing the poll
}

export class FinishPollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private draftRepository: DraftRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private notificationRepository: NotificationRepository,
    private participantRepository: ParticipantRepository,
    private boardRepository: BoardRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    rawRequest: FinishPollCommand
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = z
      .object({ pollId: PollId, userId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...rawRequest, ...decoded.data };

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

    // Mark poll as finished
    const finishResult = poll.finish(PollInstant.parse(this.clock.now()));

    if (!finishResult.success) {
      return failure(finishResult.error);
    }

    // Save the finished poll
    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // Clean up all remaining drafts for this poll
    try {
      const deleteDraftsResult = await this.draftRepository.deleteAllPollDrafts(
        command.pollId
      );

      if (!deleteDraftsResult.success) {
        // Log error but don't fail the operation
        console.error(
          'Failed to delete poll drafts:',
          deleteDraftsResult.error
        );
      }
    } catch {
      console.error('Failed to delete poll drafts after finish');
    }

    // Notify participants
    const notifyUseCase = new NotifyPollFinishedUseCase({
      notificationRepository: this.notificationRepository,
      ids: this.ids,
      clock: this.clock,
      participantRepository: this.participantRepository,
    });
    await notifyUseCase
      .execute({ pollId: poll.id, pollTitle: poll.title })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyPollFinishedUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) => {
        console.error('Failed to send poll finished notifications:', err);
      });

    return success(undefined);
  }
}
