import { Result, success, failure } from '../../domain/shared/Result';
import { Vote } from '../../domain/poll/Vote';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { DraftRepository } from '../../domain/poll/DraftRepository';
import { PollErrors } from './PollErrors';
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';

export interface FinishVotingInput {
  pollId: string;
  userId: string;
}

export class FinishVotingUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private draftRepository: DraftRepository
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

    // 2. Check if poll is active and not finished
    if (poll.isFinished()) {
      return failure(PollDomainCodes.POLL_FINISHED);
    }

    if (!poll.isActive()) {
      return failure(PollDomainCodes.POLL_NOT_ACTIVE);
    }

    // 3. Check if user is a participant
    const participantResult =
      await this.participantRepository.getParticipantByUserAndPoll(
        pollId,
        userId
      );

    if (!participantResult.success) {
      return failure(participantResult.error);
    }

    const participant = participantResult.value;

    if (!participant) {
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

    // 7. Create votes from drafts with participant weight
    const votes: Vote[] = [];

    for (const draft of drafts) {
      const voteResult = Vote.create(
        draft.questionId,
        draft.answerId,
        userId,
        participant.userWeight
      );

      if (!voteResult.success) {
        return failure(voteResult.error);
      }

      votes.push(voteResult.value);
    }

    // 8. Save all votes
    const createVotesResult = await this.voteRepository.createVotes(votes);

    if (!createVotesResult.success) {
      return failure(createVotesResult.error);
    }

    // 9. Delete user's drafts
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
