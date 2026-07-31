import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
import { PollErrors } from './PollErrors';

export interface GetUserVotingProgressInput {
  pollId: string;
  userId: string;
}

export interface GetUserVotingProgressResult {
  poll: Poll;
  drafts: VoteDraft[];
  hasFinished: boolean;
  canVote: boolean;
  answeredQuestionIds: string[];
  totalQuestions: number;
}

export class GetUserVotingProgressUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    input: GetUserVotingProgressInput
  ): Promise<Result<GetUserVotingProgressResult, string>> {
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

    // 2. Gather the facts the voting policy needs. Only organization polls
    // have participants before the vote is cast; open polls gate on the user
    // being confirmed instead.
    let isParticipant = false;

    if (!poll.isOpen()) {
      const participantResult =
        await this.participantRepository.getParticipantByUserAndPoll(
          pollId,
          userId
        );

      if (!participantResult.success) {
        return failure(participantResult.error);
      }

      isParticipant = !!participantResult.value;
    }

    let isConfirmedUser = false;

    if (poll.isOpen()) {
      const user = await this.userRepository.findById(userId);
      isConfirmedUser = user?.isConfirmed() ?? false;
    }

    // 3. Check if user has finished voting
    const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
      pollId,
      userId
    );

    if (!hasFinishedResult.success) {
      return failure(hasFinishedResult.error);
    }

    const hasFinished = hasFinishedResult.value;

    // 4. Get user's drafts
    const draftsResult = await this.draftRepository.getUserDrafts(
      pollId,
      userId
    );

    if (!draftsResult.success) {
      return failure(draftsResult.error);
    }

    const drafts = draftsResult.value;

    // 5. Calculate answered questions
    const answeredQuestionIds = Array.from(
      new Set(drafts.map((d) => d.questionId))
    );

    const activeQuestions = poll.questions.filter((q) => !q.isArchived());

    // 6. Determine if user can vote
    const canVote = PollVotingPolicy.canVote(poll, {
      isParticipant,
      isConfirmedUser,
      hasFinishedVoting: hasFinished,
    }).success;

    return success({
      poll,
      drafts,
      hasFinished,
      canVote,
      answeredQuestionIds,
      totalQuestions: activeQuestions.length,
    });
  }
}
