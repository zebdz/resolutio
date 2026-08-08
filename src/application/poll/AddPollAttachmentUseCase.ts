import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import {
  PollAttachment,
  POLL_ATTACHMENT_COUNT_LIMIT,
} from '../../domain/poll/PollAttachment';
import { PollAttachmentRepository } from '../../domain/poll/PollAttachmentRepository';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { PollErrors } from './PollErrors';

export interface PollRepoForAddAttachment {
  getPollById(pollId: string): Promise<Result<Poll | null, string>>;
}

export interface OrgRepoForAddPollAttachment {
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;
}

export interface UserRepoForAddPollAttachment {
  isSuperAdmin(userId: string): Promise<boolean>;
}

export interface AddPollAttachmentInput {
  pollId: string;
  callerId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

export interface AddPollAttachmentOutput {
  id: string;
}

export class AddPollAttachmentUseCase {
  constructor(
    private polls: PollRepoForAddAttachment,
    private orgs: OrgRepoForAddPollAttachment,
    private users: UserRepoForAddPollAttachment,
    private attachments: PollAttachmentRepository
  ) {}

  async execute(
    input: AddPollAttachmentInput
  ): Promise<Result<AddPollAttachmentOutput, string>> {
    const lookup = await this.polls.getPollById(input.pollId);

    if (!lookup.success) {
      return failure(lookup.error);
    }

    if (!lookup.value) {
      return failure(PollErrors.NOT_FOUND);
    }

    const poll = lookup.value;

    const isCreator = poll.createdBy === input.callerId;
    const isAdmin =
      !isCreator &&
      (await this.orgs.isUserAdmin(input.callerId, poll.organizationId));
    const isSuper =
      !isCreator && !isAdmin && (await this.users.isSuperAdmin(input.callerId));

    if (!isCreator && !isAdmin && !isSuper) {
      return failure(PollErrors.NOT_AUTHORIZED);
    }

    // Fail fast on a frozen poll before any file validation or further I/O.
    if (poll.isActive() || poll.isFinished()) {
      return failure(PollDomainCodes.POLL_CANNOT_CHANGE_ATTACHMENTS_ACTIVE);
    }

    const countResult = await this.attachments.countByPollId(input.pollId);

    if (!countResult.success) {
      return failure(countResult.error);
    }

    // Checked before byte validation so an over-limit upload is rejected
    // without inspecting the file.
    if (countResult.value >= POLL_ATTACHMENT_COUNT_LIMIT) {
      return failure(PollDomainCodes.POLL_ATTACHMENT_LIMIT_REACHED);
    }

    const attachmentResult = PollAttachment.createWithBytes({
      pollId: input.pollId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });

    if (!attachmentResult.success) {
      return failure(attachmentResult.error);
    }

    const saved = await this.attachments.save(
      attachmentResult.value,
      input.bytes
    );

    if (!saved.success) {
      return failure(saved.error);
    }

    return success({ id: saved.value.id });
  }
}
