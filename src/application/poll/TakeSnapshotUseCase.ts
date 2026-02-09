import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollErrors } from './PollErrors';

interface TakeSnapshotCommand {
  pollId: string;
  userId: string;
}

/**
 * Takes a participant snapshot for a poll (DRAFT → READY).
 * For board-specific polls: creates participants from board members.
 * For org-wide polls (boardId=null): creates participants from org members + descendants.
 */
export class TakeSnapshotUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(command: TakeSnapshotCommand): Promise<Result<void, string>> {
    const pollResult = await this.pollRepository.getPollById(command.pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Check authorization: superadmin or org admin
    const isSuperAdmin = await this.userRepository.isSuperAdmin(command.userId);

    if (!isSuperAdmin) {
      const isAdmin = await this.organizationRepository.isUserAdmin(
        command.userId,
        poll.organizationId
      );

      if (!isAdmin) {
        return failure(PollErrors.NOT_AUTHORIZED);
      }
    }

    // Transition to READY state (validates questions/answers)
    const snapshotResult = poll.takeSnapshot();

    if (!snapshotResult.success) {
      return failure(snapshotResult.error);
    }

    // Get member user IDs based on poll type
    let memberUserIds: string[];

    if (poll.boardId) {
      // Board-specific poll: use board members
      const boardUsers = await this.boardRepository.findBoardMembers(
        poll.boardId
      );
      memberUserIds = boardUsers.map((bu) => bu.userId);
    } else {
      // Org-wide poll: use org members + descendants (deduplicated)
      memberUserIds =
        await this.organizationRepository.findAcceptedMemberUserIdsIncludingDescendants(
          poll.organizationId
        );
    }

    // Create participants with initial weight of 1.0
    const participants: PollParticipant[] = [];
    const historyRecords: ParticipantWeightHistory[] = [];

    for (const userId of memberUserIds) {
      const participantResult = PollParticipant.create(poll.id, userId, 1.0);

      if (!participantResult.success) {
        return failure(participantResult.error);
      }

      participants.push(participantResult.value);

      // Pre-create history record (participantId will be assigned in transaction)
      const historyResult = ParticipantWeightHistory.create(
        '', // participantId assigned in transaction
        poll.id,
        userId,
        0, // oldWeight (initial)
        1.0, // newWeight
        command.userId, // changedBy (admin)
        'Initial snapshot on poll preparation'
      );

      if (historyResult.success) {
        historyRecords.push(historyResult.value);
      }
    }

    // Execute in a single transaction
    const activationResult = await this.participantRepository.executeActivation(
      poll,
      participants,
      historyRecords
    );

    if (!activationResult.success) {
      return failure(activationResult.error);
    }

    return success(undefined);
  }
}
