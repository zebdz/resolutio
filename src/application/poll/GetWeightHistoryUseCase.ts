import { Result, success, failure } from '../../domain/shared/Result';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollErrors } from './PollErrors';
import { OrganizationErrors } from '../organization/OrganizationErrors';

export interface GetWeightHistoryInput {
  pollId: string;
  adminUserId: string;
}

export interface WeightHistoryWithUser {
  history: ParticipantWeightHistory;
  changedByUser: {
    id: string;
    firstName: string;
    lastName: string;
  };
  participantUser: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface GetWeightHistoryResult {
  history: WeightHistoryWithUser[];
}

export class GetWeightHistoryUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private organizationRepository: OrganizationRepository,
    private prisma: any
  ) {}

  async execute(
    input: GetWeightHistoryInput
  ): Promise<Result<GetWeightHistoryResult, string>> {
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

    // 2. Check admin permissions
    const isAdmin = await this.organizationRepository.isUserAdmin(
      adminUserId,
      poll.organizationId
    );

    if (!isAdmin) {
      return failure(OrganizationErrors.NOT_ADMIN);
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
      const changedByUser = await this.prisma.user.findUnique({
        where: { id: record.changedBy },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      const participantUser = await this.prisma.user.findUnique({
        where: { id: record.userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      if (changedByUser && participantUser) {
        historyWithUsers.push({
          history: record,
          changedByUser,
          participantUser,
        });
      }
    }

    return success({
      history: historyWithUsers,
    });
  }
}
