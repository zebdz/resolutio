import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollErrors } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

export interface RemoveParticipantInput {
  participantId: string;
  adminUserId: string;
}

export class RemoveParticipantUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(input: RemoveParticipantInput): Promise<Result<void, string>> {
    const { participantId, adminUserId } = input;

    // 1. Get participant
    const participantResult =
      await this.participantRepository.getParticipantById(participantId);

    if (!participantResult.success) {
      return failure(participantResult.error);
    }

    const participant = participantResult.value;

    if (!participant) {
      return failure('poll.errors.participantNotFound');
    }

    // 2. Get poll
    const pollResult = await this.pollRepository.getPollById(
      participant.pollId
    );

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 3. Check admin permissions
    const isAdmin = await this.organizationRepository.isUserAdmin(
      adminUserId,
      poll.organizationId
    );

    if (!isAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // 4. Check if poll has votes (cannot remove participants if votes exist)
    const hasVotesResult = await this.voteRepository.pollHasVotes(
      participant.pollId
    );

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    if (hasVotesResult.value) {
      return failure(PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES);
    }

    // 5. Delete participant
    const deleteResult =
      await this.participantRepository.deleteParticipant(participantId);

    return deleteResult;
  }
}
