import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollState } from '../../domain/poll/PollState';

export interface OpenPollPreview {
  title: string;
  description: string;
  // Ids only, so the description renderer can resolve inline refs to this
  // poll's own files and refuse anything else. Bytes stay server-side.
  attachmentIds: string[];
  state: PollState;
  organizationName: string;
}

/**
 * The only poll read that needs no authentication. An open poll is voted on by
 * anyone holding the link, so its headline is safe to show before sign-in —
 * everything else (questions, answers, participants) stays behind the gate.
 *
 * Anything that is not a live open poll returns null, so a regular poll, an
 * archived one and a poll id that never existed are indistinguishable to an
 * anonymous caller.
 */
export class GetOpenPollPreviewUseCase {
  constructor(
    private pollRepository: PollRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(input: {
    pollId: string;
  }): Promise<Result<OpenPollPreview | null, string>> {
    const pollResult = await this.pollRepository.getPollById(input.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll || poll.isArchived() || !poll.isOpen()) {
      return success(null);
    }

    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (!organization || organization.isArchived()) {
      return success(null);
    }

    return success({
      title: poll.title,
      description: poll.description,
      attachmentIds: poll.attachmentIds,
      state: poll.state,
      organizationName: organization.name,
    });
  }
}
