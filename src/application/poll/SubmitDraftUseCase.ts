/** Saves or removes a voter's provisional selection after eligibility checks.
 * Removal is explicit; saved drafts receive application-generated identity/time. */
import { Result, success, failure } from '../../domain/shared/Result';
import {
  Clock,
  IdGenerator,
  entityCreation,
} from '@/application/shared/EntityCreation';
import {
  AnswerId,
  PollId,
  QuestionId,
  UserId,
  VoteDraftId,
} from '@/domain/shared/EntityIds';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { validateDraftSelection } from '@/domain/poll/DraftSelectionPolicy';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PollVotingPolicy } from '../../domain/poll/PollVotingPolicy';
import { PollErrors, PollUseCaseFailure } from './PollErrors';

export interface SubmitDraftInput {
  pollId: string;
  questionId: string;
  answerId: string;
  userId: string;
  isSingleChoice: boolean; // Legacy wire hint; cardinality comes from the saved question.
  shouldRemove?: boolean; // If true, remove the draft instead of adding it (for unselecting in multiple-choice)
}

export type SubmitDraftResult =
  | { readonly kind: 'saved'; readonly draft: VoteDraft }
  | { readonly kind: 'removed' };

export class SubmitDraftUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository,
    private organizationRepository: OrganizationRepository,
    private boardRepository: BoardRepository,
    private userRepository: UserRepository,
    private ids: IdGenerator,
    private clock: Clock
  ) {}

  async execute(
    input: SubmitDraftInput
  ): Promise<Result<SubmitDraftResult, PollUseCaseFailure>> {
    const { shouldRemove } = input;
    const decodedPoll = PollId.safeParse(input.pollId);
    const decodedQuestion = QuestionId.safeParse(input.questionId);
    const decodedAnswer = AnswerId.safeParse(input.answerId);
    const decodedUser = UserId.safeParse(input.userId);

    if (
      !decodedPoll.success ||
      !decodedQuestion.success ||
      !decodedAnswer.success ||
      !decodedUser.success
    ) {
      return failure(PollDomainCodes.INVALID_BALLOT);
    }

    const pollId = decodedPoll.data;
    const questionId = decodedQuestion.data;
    const answerId = decodedAnswer.data;
    const userId = decodedUser.data;

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

    const selection = validateDraftSelection(poll, questionId, answerId);

    if (!selection.success) {
      return selection;
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

      return success({ kind: 'removed' });
    }

    // 6. If single choice, delete existing drafts for this question
    if (selection.value === 'single-choice') {
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
    const draftResult = VoteDraft.create(
      pollId,
      questionId,
      answerId,
      userId,
      entityCreation(VoteDraftId, this.ids, this.clock)
    );

    if (!draftResult.success) {
      return failure(draftResult.error);
    }

    const saveResult = await this.draftRepository.saveDraft(draftResult.value);

    return saveResult.success
      ? success({ kind: 'saved', draft: saveResult.value })
      : saveResult;
  }
}
