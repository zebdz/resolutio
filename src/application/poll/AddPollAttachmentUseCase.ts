/** Authorizes uploads and decodes attachment identity/time before persistence. */
import { z } from 'zod';
import {
  PollId,
  UserId,
  OrganizationId,
  PollAttachmentId,
} from '../../domain/shared/EntityIds';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import {
  PollAttachment,
  parsePollAttachmentMetadata,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from '../../domain/poll/PollAttachment';
import { PollAttachmentRepository } from '../../domain/poll/PollAttachmentRepository';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface PollRepoForAddAttachment {
  getPollById(pollId: PollId): Promise<Result<Poll | null, PollWriteFailure>>;
}

export interface OrgRepoForAddPollAttachment {
  isUserAdmin(userId: UserId, organizationId: OrganizationId): Promise<boolean>;
}

export interface UserRepoForAddPollAttachment {
  isSuperAdmin(userId: UserId): Promise<boolean>;
}

export interface AddPollAttachmentInput {
  pollId: string;
  callerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface AddPollAttachmentOutput {
  id: PollAttachmentId;
}

export class AddPollAttachmentUseCase {
  constructor(
    private polls: PollRepoForAddAttachment,
    private orgs: OrgRepoForAddPollAttachment,
    private users: UserRepoForAddPollAttachment,
    private attachments: PollAttachmentRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    input: AddPollAttachmentInput
  ): Promise<Result<AddPollAttachmentOutput, PollUseCaseFailure>> {
    const decoded = z
      .object({ pollId: PollId, callerId: UserId })
      .safeParse(input);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const command = { ...input, ...decoded.data };
    const lookup = await this.polls.getPollById(command.pollId);

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

    // Fail fast on a frozen poll before any file validation or further I/O.
    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    const countResult = await this.attachments.countByPollId(command.pollId);

    if (!countResult.success) {
      return failure(countResult.error);
    }

    // Checked before byte validation so an over-limit upload is rejected
    // without inspecting the file.
    if (countResult.value >= POLL_ATTACHMENT_COUNT_LIMIT) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    }

    const metadata = parsePollAttachmentMetadata({
      fileName: command.fileName,
      mimeType: command.mimeType,
      sizeBytes: command.bytes.length,
    });

    if (!metadata.success) {
      return metadata;
    }

    const attachmentResult = PollAttachment.createWithBytes(
      {
        pollId: command.pollId,
        fileName: metadata.value.fileName,
        mimeType: metadata.value.mimeType,
        bytes: command.bytes,
      },
      entityCreation(PollAttachmentId, this.ids, this.clock)
    );

    if (!attachmentResult.success) {
      return failure(attachmentResult.error);
    }

    const saved = await this.attachments.save(
      attachmentResult.value,
      command.bytes
    );

    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ id: saved.value.id });
  }
}
