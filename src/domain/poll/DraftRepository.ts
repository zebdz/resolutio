import { VoteDraft } from './VoteDraft';
import { Result } from '../shared/Result';

export interface DraftRepository {
  saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>>;
  getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>>;
  deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>>;
  deleteAllPollDrafts(pollId: string): Promise<Result<void, string>>;
  deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>>;
  deleteDraftByAnswer(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Promise<Result<void, string>>;
}
