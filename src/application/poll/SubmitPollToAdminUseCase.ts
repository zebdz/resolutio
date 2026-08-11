import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { NotifyPollSubmittedUseCase } from '../notification/NotifyPollSubmittedUseCase';
import { PollErrors } from './PollErrors';

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
    private notificationRepository: NotificationRepository
  ) {}

  async execute(
    command: SubmitPollToAdminCommand
  ): Promise<Result<void, string>> {
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
      organizationRepository: this.organizationRepository,
    });

    await notifyUseCase
      .execute({
        pollId: poll.id,
        pollTitle: poll.title,
        organizationId: poll.organizationId,
        submittedByUserId: command.userId,
      })
      .catch((err) => {
        console.error('Failed to send poll submitted notifications:', err);
      });

    return success(undefined);
  }
}
