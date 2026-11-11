/** Coordinates ballot acceptance and owner-only receipt replay. Repositories
 * enforce the cutoff under lock; cleanup is best effort after commit. */
import { SealDomainCode } from '../../domain/seal/SealDomainCodes';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { Result, failure, success } from '../../domain/shared/Result';
import { validateBallot, BallotFacts } from '@/domain/poll/BallotPolicy';
import { RecordedBallot } from '@/domain/poll/BallotSnapshot';
import {
  PollId,
  UserId,
  ParticipantId,
  VoteId,
  ParticipantWeightHistoryId,
} from '@/domain/shared/EntityIds';
import { Clock, IdGenerator } from '@/application/shared/EntityCreation';
import { PollType } from '@/domain/poll/PollType';
import { ReceiptSecretGenerator } from './ReceiptSecretGenerator';
import { VoteReceiptView, voteReceiptView } from './VoteReceiptView';
import { Vote } from '../../domain/poll/Vote';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '../../domain/poll/ParticipantWeightHistory';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { PollErrors, PollUseCaseFailure } from './PollErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

export interface FinishVotingInput {
  pollId: string;
  userId: string;
  willingToSignProtocol: boolean;
}

type DecodedFinishVotingInput = Omit<FinishVotingInput, 'pollId' | 'userId'> & {
  pollId: PollId;
  userId: UserId;
};

export class FinishVotingUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private organizationRepository: OrganizationRepository,
    private boardRepository: BoardRepository,
    private userRepository: UserRepository,
    private receiptSecretGenerator: ReceiptSecretGenerator,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    input: FinishVotingInput
  ): Promise<Result<VoteReceiptView, PollUseCaseFailure | SealDomainCode>> {
    const decodedPollId = PollId.safeParse(input.pollId);
    const decodedUserId = UserId.safeParse(input.userId);

    if (!decodedPollId.success || !decodedUserId.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const pollId = decodedPollId.data;
    const userId = decodedUserId.data;
    const replay = await this.participantRepository.getCastBallot(
      pollId,
      userId
    );

    if (!replay.success) {
      return replay;
    }

    if (replay.value) {
      return voteReceiptView(replay.value);
    }

    const result = await this.cast({ ...input, pollId, userId });

    if (result.success) {
      return result;
    }

    // A competing request may have committed and removed the drafts after our
    // initial lookup. Recover its receipt instead of reporting a failed cast.
    const concurrent = await this.participantRepository.getCastBallot(
      pollId,
      userId
    );

    if (concurrent.success && concurrent.value) {
      return voteReceiptView(concurrent.value);
    }

    return result;
  }

  private async cast(
    input: DecodedFinishVotingInput
  ): Promise<Result<VoteReceiptView, PollUseCaseFailure | SealDomainCode>> {
    const { pollId, userId } = input;
    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 2. Check if organization is archived
    const organization = await this.organizationRepository.findById(
      poll.organizationId
    );

    if (organization?.isArchived()) {
      return failure(PollErrors.ORGANIZATION_ARCHIVED);
    }

    // 3. Check if board is archived (for board-specific polls)
    if (poll.boardId) {
      const board = await this.boardRepository.findById(poll.boardId);

      if (board?.isArchived()) {
        return failure(PollErrors.BOARD_ARCHIVED);
      }
    }

    // 4. Check voting eligibility. Organization polls vote as the snapshot
    // participant they already are; open polls become a participant only once
    // this vote is persisted (join-on-vote below).
    const isOpen = poll.isOpen();

    const participantResult =
      await this.participantRepository.getParticipantByUserAndPoll(
        pollId,
        userId
      );

    if (!participantResult.success) {
      return failure(participantResult.error);
    }

    const participant = participantResult.value;

    let isConfirmedUser = false;

    if (isOpen) {
      const user = await this.userRepository.findById(userId);
      isConfirmedUser = user?.isConfirmed() ?? false;
    }

    const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
      pollId,
      userId
    );

    if (!hasFinishedResult.success) {
      return failure(hasFinishedResult.error);
    }

    const eligibility = PollVotingPolicy.canVote(poll, {
      isParticipant: !!participant,
      isConfirmedUser,
      hasFinishedVoting: hasFinishedResult.value,
    });

    if (!eligibility.success) {
      return failure(eligibility.error);
    }

    // 5. Get user's drafts
    const draftsResult = await this.draftRepository.getUserDrafts(
      pollId,
      userId
    );

    if (!draftsResult.success) {
      return failure(draftsResult.error);
    }

    const drafts = draftsResult.value;

    // Early feedback uses the same domain policy as the locked write boundary.
    // Only the latter can authorize persistence after concurrent lifecycle changes.
    if (!isOpen && !participant) {
      return failure(PollDomainCodes.NOT_PARTICIPANT);
    }

    const voteWeight = isOpen
      ? VotingWeight.parse(1)
      : (participant?.userWeight ?? VotingWeight.parse(1));
    const facts = BallotFacts.safeParse({
      poll: {
        state: poll.state,
        archived: poll.isArchived(),
        pollType: isOpen ? PollType.OPEN : PollType.ORGANIZATION,
        questions: poll.questions
          .filter((q) => !q.isArchived())
          .map((q) => ({
            id: q.id,
            questionType: q.questionType,
            answerIds: q.answers
              .filter((a) => !a.isArchived())
              .map((a) => a.id),
          })),
      },
      voter: {
        userId,
        weight: voteWeight.toFixed(6),
        participant: participant !== null,
        confirmed: isConfirmedUser,
      },
      votes: drafts.map((d) => ({
        questionId: d.questionId,
        answerId: d.answerId,
        userId,
        weight: voteWeight.toFixed(6),
      })),
    });

    if (!facts.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const validation = validateBallot(
      facts.data.poll,
      facts.data.voter,
      facts.data.votes
    );

    if (!validation.success) {
      return validation;
    }

    const votes: Vote[] = [];
    const castAt = this.clock.now();

    for (const draft of drafts) {
      const voteResult = Vote.create(
        draft.questionId,
        draft.answerId,
        userId,
        voteWeight,
        { id: this.ids.generate(VoteId), now: castAt }
      );

      if (!voteResult.success) {
        return failure(voteResult.error);
      }

      votes.push(voteResult.value);
    }

    // 8. Persist the vote. An open-poll voter joins the poll at this moment:
    // participant row, its initial weight-history entry and the votes are
    // written in a single transaction so a voter never exists without a vote.
    const secret = this.receiptSecretGenerator.generate();
    let committed: Result<RecordedBallot, PollWriteFailure>;

    if (isOpen) {
      const newParticipantResult = participant
        ? success(participant)
        : PollParticipant.create(
            poll.id,
            userId,
            { id: this.ids.generate(ParticipantId), now: castAt },
            VotingWeight.parse(1)
          );

      if (!newParticipantResult.success) {
        return failure(newParticipantResult.error);
      }

      const historyResult = ParticipantWeightHistory.create(
        newParticipantResult.value.id,
        poll.id,
        userId,
        VotingWeight.parse(0),
        VotingWeight.parse(1),
        userId, // the voter joins on their own initiative
        { id: this.ids.generate(ParticipantWeightHistoryId), now: castAt },
        'open-poll-join'
      );

      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      committed = await this.participantRepository.joinAndVote(
        newParticipantResult.value,
        historyResult.value,
        votes,
        input.willingToSignProtocol,
        secret
      );
    } else {
      if (!participant) {
        return failure(PollDomainCodes.NOT_PARTICIPANT);
      }

      committed = await this.participantRepository.castVotes(
        participant.id,
        votes,
        input.willingToSignProtocol,
        secret
      );
    }

    if (!committed.success) {
      return committed;
    }

    // Cleanup is outside the committed ballot boundary. Email will follow the
    // same rule in Phase 6: its failure cannot encourage another cast.
    try {
      const cleanup = await this.draftRepository.deleteUserDrafts(
        pollId,
        userId
      );

      if (!cleanup.success) {
        console.error('Failed to delete vote drafts:', cleanup.error);
      }
    } catch {
      console.error('Failed to delete vote drafts after commit');
    }

    return voteReceiptView(committed.value);
  }
}
