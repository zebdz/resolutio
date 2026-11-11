/** Reads the authorized participant snapshot and explicit user display projections.
 * Application logic depends on repository ports rather than ORM access. */
import { Result, success, failure } from '../../domain/shared/Result';
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { PollUserDisplay, pollUserDisplay } from './PollUserDisplay';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface GetParticipantsInput {
  pollId: string;
  adminUserId: string;
}

export interface ParticipantWithUser {
  participant: PollParticipant;
  user: PollUserDisplay;
}

export interface GetParticipantsResult {
  participants: ParticipantWithUser[];
  canModify: boolean;
}

export class GetParticipantsUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    input: GetParticipantsInput
  ): Promise<
    Result<
      GetParticipantsResult,
      PollUseCaseFailure | typeof OrganizationErrors.NOT_ADMIN
    >
  > {
    const pollResultId = PollId.safeParse(input.pollId);
    const adminResultId = UserId.safeParse(input.adminUserId);

    if (!pollResultId.success || !adminResultId.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const pollId = pollResultId.data;
    const adminUserId = adminResultId.data;

    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 2. Check admin permissions: superadmin or org admin
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

    // 3. Get participants
    const participantsResult =
      await this.participantRepository.getParticipants(pollId);

    if (!participantsResult.success) {
      return failure(participantsResult.error);
    }

    const participants = participantsResult.value;

    // 4. Fetch user details for each participant
    const participantsWithUsers: ParticipantWithUser[] = [];

    for (const participant of participants) {
      const user = await this.userRepository.findById(participant.userId);

      if (user) {
        participantsWithUsers.push({
          participant,
          user: pollUserDisplay(user),
        });
      }
    }

    // 5. Check if participants can be modified (no votes exist)
    const hasVotesResult = await this.voteRepository.pollHasVotes(pollId);

    if (!hasVotesResult.success) {
      return failure(hasVotesResult.error);
    }

    const canModify = poll.canModifyParticipants(hasVotesResult.value);

    return success({
      participants: participantsWithUsers,
      canModify,
    });
  }
}
