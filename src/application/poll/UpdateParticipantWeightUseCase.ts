import { Result, success, failure } from '../../domain/shared/Result';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

export interface UpdateParticipantWeightInput {
  participantId: string;
  newWeight: number;
  adminUserId: string;
  reason?: string;
}

export class UpdateParticipantWeightUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    input: UpdateParticipantWeightInput
  ): Promise<Result<void, string>> {
    const { participantId, newWeight, adminUserId, reason } = input;

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

    // 3. Check admin permissions: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(adminUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        adminUserId,
        poll.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 4. Check if poll has votes (cannot modify weights if votes exist)
    const hasVotesResult = await this.voteRepository.pollHasVotes(
      participant.pollId
    );

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    if (hasVotesResult.value) {
      return failure(PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES);
    }

    // 5. Update participant weight
    const oldWeight = participant.userWeight;
    const updateResult = participant.updateWeight(newWeight);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // 6. Save updated participant
    const saveResult =
      await this.participantRepository.updateParticipantWeight(participant);

    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    // 7. Create weight history record
    const historyResult = ParticipantWeightHistory.create(
      participantId,
      participant.pollId,
      participant.userId,
      oldWeight,
      newWeight,
      adminUserId,
      reason || null
    );

    if (!historyResult.success) {
      return failure(historyResult.error);
    }

    const createHistoryResult =
      await this.participantRepository.createWeightHistory(historyResult.value);

    if (!createHistoryResult.success) {
      return failure(createHistoryResult.error);
    }

    return success(undefined);
  }
}
