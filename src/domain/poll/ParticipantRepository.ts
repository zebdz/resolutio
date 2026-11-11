/** Participant snapshot, ballot and audit persistence contracts.
 * Domain identities remain distinct across all queries and transactional writes. */
import { DistributionType } from '@/domain/poll/DistributionType';
import { PropertyAggregation } from '@/domain/poll/PropertyAggregation';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { EntityCreation } from '../shared/EntityCreation';
import { ParticipantWeightHistoryId } from '../shared/EntityIds';
import { PropertyId } from '@/domain/shared/EntityIds';
import { Poll } from './Poll';
import { PollParticipant } from './PollParticipant';
import { ParticipantWeightHistory } from './ParticipantWeightHistory';
import { Vote } from './Vote';
import { Result } from '../shared/Result';
import { ReceiptSecret } from './ReceiptSecret';
import { RecordedBallot } from './BallotSnapshot';
import { PollRevision } from './PollRevision';
import { PollId, UserId, ParticipantId } from './PollValues';
import { PollWriteFailure } from './PollWriteFailure';

export interface ParticipantAddition {
  readonly userId: UserId;
  readonly weight: VotingWeight;
  readonly creation: EntityCreation<ParticipantId>;
  readonly historyCreation: EntityCreation<ParticipantWeightHistoryId>;
}
export interface ParticipantRemoval {
  readonly participantId: ParticipantId;
  readonly userId: UserId;
  readonly oldWeight: VotingWeight;
  readonly historyCreation: EntityCreation<ParticipantWeightHistoryId>;
}
export interface ParticipantReweighting extends ParticipantRemoval {
  readonly newWeight: VotingWeight;
}

export interface ParticipantRepository {
  /** Owner lookup; callers supply the authenticated user, never a client user ID. */
  getCastBallot(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<RecordedBallot | null, PollWriteFailure>>;
  /** Atomically accepts a whole ballot or replays the already committed ballot. */
  castVotes(
    participantId: ParticipantId,
    votes: Vote[],
    willingToSignProtocol: boolean,
    receiptSecret: ReceiptSecret
  ): Promise<Result<RecordedBallot, PollWriteFailure>>;
  // Participant operations
  createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, PollWriteFailure>>;
  getParticipants(
    pollId: PollId
  ): Promise<Result<PollParticipant[], PollWriteFailure>>;
  getParticipantById(
    participantId: ParticipantId
  ): Promise<Result<PollParticipant | null, PollWriteFailure>>;
  getParticipantByUserAndPoll(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<PollParticipant | null, PollWriteFailure>>;
  updateParticipantWeight(
    participant: PollParticipant,
    history: ParticipantWeightHistory
  ): Promise<Result<void, PollWriteFailure>>;
  deleteParticipant(
    participantId: ParticipantId
  ): Promise<Result<void, PollWriteFailure>>;
  deleteParticipantsByPollId(
    pollId: PollId
  ): Promise<Result<void, PollWriteFailure>>;
  updateWillingToSignProtocol(
    participantId: ParticipantId,
    willingToSignProtocol: boolean
  ): Promise<Result<void, PollWriteFailure>>;

  // Weight history operations
  createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, PollWriteFailure>>;
  getWeightHistory(
    pollId: PollId
  ): Promise<Result<ParticipantWeightHistory[], PollWriteFailure>>;
  getParticipantWeightHistory(
    participantId: ParticipantId
  ): Promise<Result<ParticipantWeightHistory[], PollWriteFailure>>;

  // Transactional operations
  executeActivation(
    poll: Poll,
    participants: PollParticipant[],
    historyRecords: ParticipantWeightHistory[]
  ): Promise<Result<PollParticipant[], PollWriteFailure>>;

  /**
   * Join-on-vote for open polls: creates the participant (weight 1), its
   * initial weight-history row and the user's votes in one transaction.
   * Idempotent on (pollId, userId) for the participant row.
   */
  joinAndVote(
    participant: PollParticipant,
    history: ParticipantWeightHistory,
    votes: Vote[],
    willingToSignProtocol: boolean,
    receiptSecret: ReceiptSecret
  ): Promise<Result<RecordedBallot, PollWriteFailure>>;

  pollHasVotes(pollId: PollId): Promise<Result<boolean, PollWriteFailure>>;

  /**
   * Atomic reconfigure: applies adds/removes/updates to poll_participants,
   * writes one ParticipantWeightHistory per change, updates polls columns,
   * and replaces poll_properties rows.
   */
  applyWeightConfigChange(
    pollId: PollId,
    newDistributionType: DistributionType,
    newPropertyAggregation: PropertyAggregation,
    newPropertyIds: PropertyId[],
    add: ParticipantAddition[],
    remove: ParticipantRemoval[],
    update: ParticipantReweighting[],
    adminUserId: UserId,
    reason: string,
    expectedRevision: PollRevision
  ): Promise<Result<void, PollWriteFailure>>;
}
