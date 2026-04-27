import { Poll } from './Poll';
import { PollParticipant } from './PollParticipant';
import { ParticipantWeightHistory } from './ParticipantWeightHistory';
import { Result } from '../shared/Result';

export interface ParticipantRepository {
  // Participant operations
  createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>>;
  getParticipants(pollId: string): Promise<Result<PollParticipant[], string>>;
  getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>>;
  getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>>;
  updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>>;
  deleteParticipant(participantId: string): Promise<Result<void, string>>;
  deleteParticipantsByPollId(pollId: string): Promise<Result<void, string>>;
  updateWillingToSignProtocol(
    participantId: string,
    willingToSignProtocol: boolean
  ): Promise<Result<void, string>>;

  // Weight history operations
  createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>>;
  getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>>;
  getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>>;

  // Transactional operations
  executeActivation(
    poll: Poll,
    participants: PollParticipant[],
    historyRecords: ParticipantWeightHistory[]
  ): Promise<Result<PollParticipant[], string>>;

  pollHasVotes(pollId: string): Promise<Result<boolean, string>>;

  /**
   * Atomic reconfigure: applies adds/removes/updates to poll_participants,
   * writes one ParticipantWeightHistory per change, updates polls columns,
   * and replaces poll_properties rows.
   */
  applyWeightConfigChange(
    pollId: string,
    newDistributionType: string,
    newPropertyAggregation: string,
    newPropertyIds: string[],
    add: Array<{ userId: string; weight: number }>,
    remove: Array<{ participantId: string; userId: string; oldWeight: number }>,
    update: Array<{
      participantId: string;
      userId: string;
      oldWeight: number;
      newWeight: number;
    }>,
    adminUserId: string,
    reason: string
  ): Promise<Result<void, string>>;
}
