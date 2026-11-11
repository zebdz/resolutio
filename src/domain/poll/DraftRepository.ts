/** Draft persistence keeps typed selection identities and explicit failure codes.
 * Saving the same logical selection may replay its existing persisted identity. */
import { PollId, QuestionId, AnswerId, UserId } from '../shared/EntityIds';
import { VoteDraft } from './VoteDraft';
import { Result } from '../shared/Result';

export type DraftRepositoryFailure = 'common.errors.unexpected';

export interface DraftRepository {
  saveDraft(
    draft: VoteDraft
  ): Promise<Result<VoteDraft, DraftRepositoryFailure>>;
  getUserDrafts(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<VoteDraft[], DraftRepositoryFailure>>;
  deleteUserDrafts(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<void, DraftRepositoryFailure>>;
  deleteAllPollDrafts(
    pollId: PollId
  ): Promise<Result<void, DraftRepositoryFailure>>;
  deleteDraftsByQuestion(
    pollId: PollId,
    questionId: QuestionId,
    userId: UserId
  ): Promise<Result<void, DraftRepositoryFailure>>;
  deleteDraftByAnswer(
    pollId: PollId,
    questionId: QuestionId,
    answerId: AnswerId,
    userId: UserId
  ): Promise<Result<void, DraftRepositoryFailure>>;
}
