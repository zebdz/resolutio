/** Authorizes poll-content access before reading a voter's progress.
 * Draft and answered-question references keep their domain identity types. */
import { QuestionCount } from '../../domain/poll/QuestionValues';
import { Result, success, failure } from '../../domain/shared/Result';
import { PollId, UserId, QuestionId } from '@/domain/shared/EntityIds';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { Poll } from '../../domain/poll/Poll';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollReadPolicy } from '../../domain/poll/PollReadPolicy';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface GetUserVotingProgressInput {
  pollId: string;
  userId: string;
}

export interface GetUserVotingProgressResult {
  poll: Poll;
  drafts: VoteDraft[];
  hasFinished: boolean;
  canVote: boolean;
  answeredQuestionIds: QuestionId[];
  totalQuestions: QuestionCount;
}

export class GetUserVotingProgressUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private userRepository: UserRepository,
    private organizationRepository: OrganizationRepository
  ) {}

  async execute(
    input: GetUserVotingProgressInput
  ): Promise<Result<GetUserVotingProgressResult, PollUseCaseFailure>> {
    const parsedPollId = PollId.safeParse(input.pollId);
    const parsedUserId = UserId.safeParse(input.userId);

    if (!parsedPollId.success || !parsedUserId.success) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const pollId = parsedPollId.data;
    const userId = parsedUserId.data;

    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;

    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // Match poll-content access even when a direct action caller bypasses the vote page.
    if (!poll.isOpen()) {
      const isSuperAdmin = await this.userRepository.isSuperAdmin(userId);
      const [isOrgMember, isOrgAdmin] = isSuperAdmin
        ? [false, false]
        : await Promise.all([
            this.organizationRepository.isUserMember(
              userId,
              poll.organizationId
            ),
            this.organizationRepository.isUserAdmin(
              userId,
              poll.organizationId
            ),
          ]);

      if (
        !PollReadPolicy.canViewPoll(poll, {
          isAdmin: isSuperAdmin || isOrgAdmin,
          isOrgMember,
        })
      ) {
        return failure(PollErrors.NOT_ORG_MEMBER);
      }
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
      totalQuestions: QuestionCount.parse(activeQuestions.length),
    });
  }
}
