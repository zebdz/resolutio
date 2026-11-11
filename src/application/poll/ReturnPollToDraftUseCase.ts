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
import { NotifyPollReturnedToDraftUseCase } from '../notification/NotifyPollReturnedToDraftUseCase';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

interface ReturnPollToDraftCommand {
  pollId: string;
  userId: string;
}

/**
 * Sends a submitted poll back for editing (SUBMITTED → DRAFT).
 *
 * One transition serving two people: the author recalling a poll they sent too
 * early, and an admin handing one back because it needs changes. Both end in
 * the same place — the author editing again — so they share a use case, and
 * only the caller's role differs.
 *
 * Only from SUBMITTED. Once an admin has frozen participants the poll is
 * READY, and the way back from there is discardSnapshot, which has to reckon
 * with votes already cast.
 */
export class ReturnPollToDraftUseCase {
  constructor(
    private pollRepository: PollRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private notificationRepository: NotificationRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    rawRequest: ReturnPollToDraftCommand
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

    const isCreator = poll.createdBy === command.userId;

    if (!isCreator) {
      const isSuperAdmin = await this.userRepository.isSuperAdmin(
        command.userId
      );

      if (!isSuperAdmin) {
        const isAdmin = await this.organizationRepository.isUserAdmin(
          command.userId,
          poll.organizationId
        );

        if (!isAdmin) {
          return failure(PollErrors.NOT_AUTHORIZED);
        }
      }
    }

    const returnResult = poll.returnToDraft();

    if (!returnResult.success) {
      return failure(returnResult.error);
    }

    const updateResult = await this.pollRepository.updatePoll(poll);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    const notifyUseCase = new NotifyPollReturnedToDraftUseCase({
      notificationRepository: this.notificationRepository,
      ids: this.ids,
      clock: this.clock,
    });

    await notifyUseCase
      .execute({
        pollId: poll.id,
        pollTitle: poll.title,
        createdBy: poll.createdBy,
        returnedByUserId: command.userId,
      })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyPollReturnedToDraftUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) => {
        console.error('Failed to send poll returned notifications:', err);
      });

    return success(undefined);
  }
}
