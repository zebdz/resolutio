/** Applies authorized snapshot weight changes with explicit audit identity/time.
 * Domain validation precedes writes; the repository enforces the locked cutoff. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  Clock,
  IdGenerator,
  entityCreation,
} from '@/application/shared/EntityCreation';
import {
  ParticipantId,
  UserId,
  ParticipantWeightHistoryId,
} from '@/domain/shared/EntityIds';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

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
    private userRepository: UserRepository,
    private boardRepository: BoardRepository,
    private ids: IdGenerator,
    private clock: Clock,
    private profanityChecker?: ProfanityChecker
  ) {}

  async execute(
    input: UpdateParticipantWeightInput
  ): Promise<
    Result<void, PollUseCaseFailure | typeof OrganizationErrors.NOT_ADMIN>
  > {
    const { reason } = input;
    const participantIdResult = ParticipantId.safeParse(input.participantId);
    const adminResult = UserId.safeParse(input.adminUserId);

    if (!participantIdResult.success || !adminResult.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const participantId = participantIdResult.data;
    const adminUserId = adminResult.data;

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

    // Open polls are one person = one vote, and a participant row exists only
    // because that person already voted — changing its weight would rewrite a
    // vote that was already cast.
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

    // 6. Check if poll has votes (cannot modify weights if votes exist)
    const hasVotesResult = await this.voteRepository.pollHasVotes(
      participant.pollId
    );

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    if (hasVotesResult.value) {
      return failure(PollDomainCodes.CANNOT_MODIFY_PARTICIPANTS_HAS_VOTES);
    }

    const weight = VotingWeight.safeParse(input.newWeight);

    if (!weight.success) {
      return failure(PollDomainCodes.INVALID_WEIGHT);
    }

    const newWeight = weight.data;

    // Validate the audit entry before mutating or persisting the participant.
    const historyResult = ParticipantWeightHistory.create(
      participantId,
      participant.pollId,
      participant.userId,
      participant.userWeight,
      newWeight,
      adminUserId,
      entityCreation(ParticipantWeightHistoryId, this.ids, this.clock),
      reason || null,
      this.profanityChecker
    );

    if (!historyResult.success) {
      return failure(historyResult.error);
    }

    // 5. Update participant weight
    const updateResult = participant.updateWeight(newWeight);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // Save the updated participant and its audit entry atomically.
    const saveResult = await this.participantRepository.updateParticipantWeight(
      participant,
      historyResult.value
    );

    if (!saveResult.success) {
      return failure(saveResult.error);
    }

    return success(undefined);
  }
}
