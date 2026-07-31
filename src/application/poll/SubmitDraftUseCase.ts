import { Result, success, failure } from '../../domain/shared/Result';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
import { PollErrors } from './PollErrors';

export interface SubmitDraftInput {
  pollId: string;
  questionId: string;
  answerId: string;
  userId: string;
  isSingleChoice: boolean; // If true, delete other drafts for this question first
  shouldRemove?: boolean; // If true, remove the draft instead of adding it (for unselecting in multiple-choice)
}

export class SubmitDraftUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private organizationRepository: OrganizationRepository,
    private boardRepository: BoardRepository,
    private userRepository: UserRepository
  ) {}

  async execute(input: SubmitDraftInput): Promise<Result<VoteDraft, string>> {
    const {
      pollId,
      questionId,
      answerId,
      userId,
      isSingleChoice,
      shouldRemove,
    } = input;

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

    // 4. Check voting eligibility. Organization polls need a snapshot
    // participant; open polls need a confirmed user, since the voter only
    // becomes a participant once they finish voting.
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

    const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
      pollId,
      userId
    );

    if (!hasFinishedResult.success) {
      return failure(hasFinishedResult.error);
    }

    const eligibility = PollVotingPolicy.canVote(poll, {
      isParticipant,
      isConfirmedUser,
      hasFinishedVoting: hasFinishedResult.value,
    });

    if (!eligibility.success) {
      return failure(eligibility.error);
    }

    // 5. If shouldRemove is true, delete the specific draft and return
    if (shouldRemove) {
      const deleteResult = await this.draftRepository.deleteDraftByAnswer(
        pollId,
        questionId,
        answerId,
        userId
      );

      if (!deleteResult.success) {
        return failure(deleteResult.error);
      }

      // Return success with a dummy draft (caller doesn't use the value)
      const dummyDraft = VoteDraft.create(pollId, questionId, answerId, userId);

      return dummyDraft;
    }

    // 6. If single choice, delete existing drafts for this question
    if (isSingleChoice) {
      const deleteResult = await this.draftRepository.deleteDraftsByQuestion(
        pollId,
        questionId,
        userId
      );

      if (!deleteResult.success) {
        return failure(deleteResult.error);
      }
    }

    // 7. Create and save draft
    const draftResult = VoteDraft.create(pollId, questionId, answerId, userId);

    if (!draftResult.success) {
      return failure(draftResult.error);
    }

    const saveResult = await this.draftRepository.saveDraft(draftResult.value);

    return saveResult;
  }
}
