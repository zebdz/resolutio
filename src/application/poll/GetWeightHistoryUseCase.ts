/** Reads authorized weight audit entries and explicit user display projections.
 * User lookup stays behind a core port, keeping ORM and private profile fields out. */
import { PollId, UserId } from '@/domain/shared/EntityIds';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { PollUserDisplay, pollUserDisplay } from './PollUserDisplay';
import { Result, success, failure } from '../../domain/shared/Result';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface GetWeightHistoryInput {
  pollId: string;
  adminUserId: string;
}

export interface WeightHistoryWithUser {
  history: ParticipantWeightHistory;
  changedByUser: PollUserDisplay;
  participantUser: PollUserDisplay;
}

export interface GetWeightHistoryResult {
  history: WeightHistoryWithUser[];
}

export class GetWeightHistoryUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    input: GetWeightHistoryInput
  ): Promise<
    Result<
      GetWeightHistoryResult,
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

    // 3. Get weight history
    const historyResult =
      await this.participantRepository.getWeightHistory(pollId);

    if (!historyResult.success) {
      return failure(historyResult.error);
    }

    const history = historyResult.value;

    // 4. Fetch user details for each history record
    const historyWithUsers: WeightHistoryWithUser[] = [];

    for (const record of history) {
      const changedByUser = await this.userRepository.findById(
        record.changedBy
      );
      const participantUser = await this.userRepository.findById(record.userId);

      if (changedByUser && participantUser) {
        historyWithUsers.push({
          history: record,
          changedByUser: pollUserDisplay(changedByUser),
          participantUser: pollUserDisplay(participantUser),
        });
      }
    }

    return success({
      history: historyWithUsers,
    });
  }
}
