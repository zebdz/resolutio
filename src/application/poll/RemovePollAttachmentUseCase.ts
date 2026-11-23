/** Decodes attachment removal requests before resolving their authoritative poll. */
import { z } from 'zod';
import {
  PollId,
  UserId,
  OrganizationId,
  PollAttachmentId,
} from '../../domain/shared/EntityIds';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { Result, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { PollAttachmentRepository } from '../../domain/poll/PollAttachmentRepository';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface PollRepoForRemoveAttachment {
  getPollById(pollId: PollId): Promise<Result<Poll | null, PollWriteFailure>>;
}

export interface OrgRepoForRemovePollAttachment {
  isUserAdmin(userId: UserId, organizationId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForRemovePollAttachment {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface RemovePollAttachmentInput {
  attachmentId: string;
  callerId: string;
}

/**
 * Deleting an attachment row is permitted: it is not one of the entities the
 * archive-only rule protects. It is content of a not-yet-published poll,
 * comparable to the vote drafts the rules already allow deleting — and the
 * ACTIVE guard below means nothing can be removed once a poll's evidence has
 * been put to voters.
 */
export class RemovePollAttachmentUseCase {
  constructor(
    private polls: PollRepoForRemoveAttachment,
    private orgs: OrgRepoForRemovePollAttachment,
    private users: UserRepoForRemovePollAttachment,
    private attachments: PollAttachmentRepository
  ) {}

  async execute(
    input: RemovePollAttachmentInput
  ): Promise<Result<void, PollUseCaseFailure>> {
    const decoded = z
      .object({ attachmentId: PollAttachmentId, callerId: UserId })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = decoded.data;
    const metaResult = await this.attachments.findById(command.attachmentId);

    if (!metaResult.success) {
      return failure(metaResult.error);
    }

    if (!metaResult.value) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_NOT_FOUND);
    }

    // The poll is resolved from the attachment's own pollId, never from
    // caller input, so a caller cannot authorize against a different poll.
    const lookup = await this.polls.getPollById(metaResult.value.pollId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(PollErrors.NOT_FOUND);
    }

    const poll = lookup.value;

    const isCreator = poll.createdBy === command.callerId;
    const isAdmin =
      !isCreator &&
      (await this.orgs.isUserAdmin(command.callerId, poll.organizationId));
    const isSuper =
      !isCreator &&
      !isAdmin &&
      (await this.users.isSuperAdmin(command.callerId));

    if (!isCreator && !isAdmin && !isSuper) {
      return failure(PollErrors.NOT_AUTHORIZED);
    }

    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    return this.attachments.deleteById(command.attachmentId);
  }
}
