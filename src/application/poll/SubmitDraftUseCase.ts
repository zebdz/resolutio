import { Result, success, failure } from '../../domain/shared/Result';
import { VoteDraft } from '../../domain/poll/VoteDraft';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { PollErrors } from './PollErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

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
    private draftRepository: DraftRepository
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

    // 2. Check if poll is active and not finished
    if (poll.isFinished()) {
      return failure(PollDomainCodes.POLL_FINISHED);
    }

    if (!poll.isActive()) {
      return failure(PollDomainCodes.POLL_NOT_ACTIVE);
    }

    // 3. Check if user is a participant
    const participantResult =
      await this.participantRepository.getParticipantByUserAndPoll(pollId, userId);
    if (!participantResult.success) {
      return failure(participantResult.error);
    }

    if (!participantResult.value) {
      return failure(PollDomainCodes.NOT_PARTICIPANT);
    }

    // 4. Check if user has already finished voting
    const hasFinishedResult = await this.voteRepository.hasUserFinishedVoting(
      pollId,
      userId
    );
    if (!hasFinishedResult.success) {
      return failure(hasFinishedResult.error);
    }

    if (hasFinishedResult.value) {
      return failure(PollDomainCodes.ALREADY_VOTED);
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
