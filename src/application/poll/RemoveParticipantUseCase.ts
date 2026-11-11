/** Removes an eligible snapshot participant after authorization and voting checks.
 * External identifiers are decoded before they enter repository contracts. */
import { Result, success, failure } from '../../domain/shared/Result';
import { ParticipantId, UserId } from '@/domain/shared/EntityIds';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
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
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository,
    private boardRepository: BoardRepository
  ) {}

  async execute(
    input: RemoveParticipantInput
  ): Promise<
    Result<void, PollUseCaseFailure | typeof OrganizationErrors.NOT_ADMIN>
  > {
    const parsedParticipantId = ParticipantId.safeParse(input.participantId);
    const parsedAdminId = UserId.safeParse(input.adminUserId);

    if (!parsedParticipantId.success || !parsedAdminId.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const participantId = parsedParticipantId.data;
    const adminUserId = parsedAdminId.data;

    // 1. Get participant
    const participantResult =
      await this.participantRepository.getParticipantById(participantId);

    if (!participantResult.success) {
      return failure(participantResult.error);
    }

    const participant = participantResult.value;

    if (!participant) {
      return failure(PollErrors.PARTICIPANT_NOT_FOUND);
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

    // A participant of an open poll has by definition already voted, so
    // removing the row would destroy a cast vote.
    if (poll.isOpen()) {
      return failure(PollErrors.OPEN_PARTICIPANTS_IMMUTABLE);
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

    // 4. Check if organization is archived
    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (organization?.isArchived()) {
      return failure(PollErrors.ORGANIZATION_ARCHIVED);
    }

    // 5. Check if board is archived
    if (poll.boardId) {
      const board = await this.boardRepository.findById(poll.boardId);

      if (board?.isArchived()) {
        return failure(PollErrors.BOARD_ARCHIVED);
      }
    }

    // 6. Check if poll has votes (cannot remove participants if votes exist)
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
