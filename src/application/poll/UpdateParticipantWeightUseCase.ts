import { Result, success, failure } from '../../domain/shared/Result';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
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
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(
    input: UpdateParticipantWeightInput
  ): Promise<Result<void, string>> {
    const { participantId, newWeight, adminUserId, reason } = input;

    // 1. Get participant
    const participantResult =
      await this.pollRepository.getParticipantById(participantId);
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

    // 3. Get board and check admin permissions
    const board = await this.boardRepository.findById(poll.boardId);
    if (!board) {
      return failure(PollErrors.BOARD_NOT_FOUND);
    }

    const isAdmin = await this.organizationRepository.isUserAdmin(
      adminUserId,
      board.organizationId
    );

    if (!isAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // 4. Check if poll has votes (cannot modify weights if votes exist)
    const hasVotesResult = await this.pollRepository.pollHasVotes(
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
      await this.pollRepository.updateParticipantWeight(participant);
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

    const createHistoryResult = await this.pollRepository.createWeightHistory(
      historyResult.value
    );
    if (!createHistoryResult.success) {
      return failure(createHistoryResult.error);
    }

    return success(undefined);
  }
}
