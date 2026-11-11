/** Poll application boundary validates requests, invokes domain behavior and
 * preserves known failure codes across authorization and persistence ports. */
import { Clock, IdGenerator } from '../shared/EntityCreation';
import { Instant } from '../../domain/shared/Instant';
import { z } from 'zod';
import { PollId, UserId } from '../../domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { NotifyPollSubmittedUseCase } from '../notification/NotifyPollSubmittedUseCase';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

interface SubmitPollToAdminCommand {
  pollId: string;
  userId: string;
}

/**
 * Hands a poll to the organization's admins (DRAFT → SUBMITTED).
 *
 * The author's decision, so unlike every other transition this one is not an
 * admin action: only the poll's creator (or a superadmin) may take it. An
 * admin cannot submit on the author's behalf, since the whole point of the
 * state is to record that the author considers the poll finished.
 */
export class SubmitPollToAdminUseCase {
  constructor(
    private pollRepository: PollRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private notificationRepository: NotificationRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    rawRequest: SubmitPollToAdminCommand
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = z
      .object({ pollId: PollId, userId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...rawRequest, ...decoded.data };

    const pollResult = await this.pollRepository.getPollById(command.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    const isSuperAdmin = await this.userRepository.isSuperAdmin(command.userId);

    if (!isSuperAdmin && poll.createdBy !== command.userId) {
      return failure(PollErrors.NOT_AUTHORIZED);
    }

    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (organization?.isArchived()) {
      return failure(PollErrors.ORGANIZATION_ARCHIVED);
    }

    const submitResult = poll.submitToAdmin();

    if (!submitResult.success) {
      return failure(submitResult.error);
    }

    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    const notifyUseCase = new NotifyPollSubmittedUseCase({
      notificationRepository: this.notificationRepository,
      ids: this.ids,
      clock: this.clock,
      organizationRepository: this.organizationRepository,
    });

    await notifyUseCase
      .execute({
        pollId: poll.id,
        pollTitle: poll.title,
        organizationId: poll.organizationId,
        submittedByUserId: command.userId,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyPollSubmittedUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) => {
        console.error('Failed to send poll submitted notifications:', err);
      });

    return success(undefined);
  }
}
