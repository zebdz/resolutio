import { Result, success, failure } from '../../domain/shared/Result';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface GetParticipantsInput {
  pollId: string;
  adminUserId: string;
}

export interface ParticipantWithUser {
  participant: PollParticipant;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
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
    private userRepository: UserRepository,
    private prisma: any
  ) {}

  async execute(
    input: GetParticipantsInput
  ): Promise<Result<GetParticipantsResult, string>> {
    const { pollId, adminUserId } = input;

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
      const user = await this.prisma.user.findUnique({
        where: { id: participant.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
        },
      });

      if (user) {
        participantsWithUsers.push({
          participant,
          user,
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
