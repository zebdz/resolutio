import { Result, success, failure } from '../../domain/shared/Result';
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
import { PollErrors } from './PollErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

export interface FinishVotingInput {
  pollId: string;
  userId: string;
  willingToSignProtocol: boolean;
}

export class FinishVotingUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private organizationRepository: OrganizationRepository,
    private boardRepository: BoardRepository,
    private userRepository: UserRepository
  ) {}

  async execute(input: FinishVotingInput): Promise<Result<void, string>> {
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

    let participant: PollParticipant | null = null;

    if (!isOpen) {
      const participantResult =
        await this.participantRepository.getParticipantByUserAndPoll(
          pollId,
          userId
        );

      if (!participantResult.success) {
        return failure(participantResult.error);
      }

      participant = participantResult.value;
    }

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

    // 6. Validate that all questions are answered
    const questions = poll.questions.filter((q) => !q.isArchived());
    const answeredQuestionIds = new Set(drafts.map((d) => d.questionId));

    if (answeredQuestionIds.size !== questions.length) {
      return failure(PollDomainCodes.MUST_ANSWER_ALL_QUESTIONS);
    }

    // 6b. Validate single-choice questions have exactly 1 draft
    const draftsByQuestion = new Map<string, number>();

    for (const draft of drafts) {
      draftsByQuestion.set(
        draft.questionId,
        (draftsByQuestion.get(draft.questionId) || 0) + 1
      );
    }

    for (const question of questions) {
      if (question.questionType === 'single-choice') {
        const draftCount = draftsByQuestion.get(question.id) || 0;

        if (draftCount > 1) {
          return failure(PollDomainCodes.SINGLE_CHOICE_MULTIPLE_ANSWERS);
        }
      }
    }

    // 7. Create votes from drafts. Open polls are one person = one vote;
    // organization polls use the weight the snapshot assigned.
    const voteWeight = isOpen ? 1 : participant!.userWeight;

    const votes: Vote[] = [];

    for (const draft of drafts) {
      const voteResult = Vote.create(
        draft.questionId,
        draft.answerId,
        userId,
        voteWeight
      );

      if (!voteResult.success) {
        return failure(voteResult.error);
      }

      votes.push(voteResult.value);
    }

    // 8. Persist the vote. An open-poll voter joins the poll at this moment:
    // participant row, its initial weight-history entry and the votes are
    // written in a single transaction so a voter never exists without a vote.
    if (isOpen) {
      const newParticipantResult = PollParticipant.create(poll.id, userId, 1);

      if (!newParticipantResult.success) {
        return failure(newParticipantResult.error);
      }

      const historyResult = ParticipantWeightHistory.create(
        '', // participantId assigned inside the transaction
        poll.id,
        userId,
        0,
        1,
        userId, // the voter joins on their own initiative
        'open-poll-join'
      );

      if (!historyResult.success) {
        return failure(historyResult.error);
      }

      const joinResult = await this.participantRepository.joinAndVote(
        newParticipantResult.value,
        historyResult.value,
        votes,
        input.willingToSignProtocol
      );

      if (!joinResult.success) {
        return failure(joinResult.error);
      }
    } else {
      const createVotesResult = await this.voteRepository.createVotes(votes);

      if (!createVotesResult.success) {
        return failure(createVotesResult.error);
      }

      // 9. Save willingToSignProtocol
      const protocolResult =
        await this.participantRepository.updateWillingToSignProtocol(
          participant!.id,
          input.willingToSignProtocol
        );

      if (!protocolResult.success) {
        return failure(protocolResult.error);
      }
    }

    // 10. Delete user's drafts
    const deleteResult = await this.draftRepository.deleteUserDrafts(
      pollId,
      userId
    );

    if (!deleteResult.success) {
      return failure(deleteResult.error);
    }

    return success(undefined);
  }
}
