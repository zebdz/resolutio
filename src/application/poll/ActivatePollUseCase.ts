import { Result, success, failure } from '../../domain/shared/Result';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { PollErrors } from './PollErrors';

interface ActivatePollCommand {
  pollId: string;
  userId: string; // Admin user activating the poll
}

export class ActivatePollUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository
  ) {}

  async execute(command: ActivatePollCommand): Promise<Result<void, string>> {
    // Get the poll
    const pollResult = await this.pollRepository.getPollById(command.pollId);
    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;
    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Activate the poll
    const activateResult = poll.activate();
    if (!activateResult.success) {
      return failure(activateResult.error);
    }

    // If this is the first activation, create participant snapshot
    if (!poll.participantsSnapshotTaken) {
      // Get the board
      const board = await this.boardRepository.findById(poll.boardId);
      if (!board) {
        return failure(PollErrors.BOARD_NOT_FOUND);
      }

      // Get all board members from database
      const boardUsers = await this.boardRepository.findBoardMembers(board.id);

      // Create participants with initial weight of 1.0
      const participants: PollParticipant[] = [];
      const historyRecords: ParticipantWeightHistory[] = [];

      for (const boardUser of boardUsers) {
        const participantResult = PollParticipant.create(
          poll.id,
          boardUser.userId,
          1.0
        );

        if (!participantResult.success) {
          return failure(participantResult.error);
        }

        participants.push(participantResult.value);
      }

      // Save participants
      if (participants.length > 0) {
        const createParticipantsResult =
          await this.pollRepository.createParticipants(participants);

        if (!createParticipantsResult.success) {
          return failure(createParticipantsResult.error);
        }

        // Get the saved participants to get their IDs
        const savedParticipantsResult =
          await this.pollRepository.getParticipants(poll.id);

        if (!savedParticipantsResult.success) {
          return failure(savedParticipantsResult.error);
        }

        // Create initial weight history records
        for (const participant of savedParticipantsResult.value) {
          const historyResult = ParticipantWeightHistory.create(
            participant.id,
            poll.id,
            participant.userId,
            0, // oldWeight (initial)
            participant.userWeight, // newWeight
            command.userId, // changedBy (admin activating)
            'Initial snapshot on poll activation'
          );

          if (historyResult.success) {
            historyRecords.push(historyResult.value);
          }
        }

        // Save history records
        for (const history of historyRecords) {
          await this.pollRepository.createWeightHistory(history);
        }
      }

      // Mark snapshot as taken
      poll.takeParticipantsSnapshot();
    }

    // Save the updated poll
    const updateResult = await this.pollRepository.updatePoll(poll);
    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    return success(undefined);
  }
}
