import { Poll } from './Poll';
import { Question } from './Question';
import { Answer } from './Answer';
import { Vote } from './Vote';
import { VoteDraft } from './VoteDraft';
import { PollParticipant } from './PollParticipant';
import { ParticipantWeightHistory } from './ParticipantWeightHistory';
import { Result } from '../shared/Result';

export interface UpdateQuestionOrderData {
  questionId: string;
  page: number;
  order: number;
}

export interface PollRepository {
  // Poll operations
  createPoll(poll: Poll): Promise<Result<Poll, string>>;
  getPollById(pollId: string): Promise<Result<Poll | null, string>>;
  getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>>;
  getPollsByUserId(userId: string): Promise<Result<Poll[], string>>;
  updatePoll(poll: Poll): Promise<Result<void, string>>;
  deletePoll(pollId: string): Promise<Result<void, string>>;
  pollHasVotes(pollId: string): Promise<Result<boolean, string>>;

  // Question operations
  createQuestion(question: Question): Promise<Result<Question, string>>;
  getQuestionById(questionId: string): Promise<Result<Question | null, string>>;
  getQuestionsByPollId(pollId: string): Promise<Result<Question[], string>>;
  updateQuestion(question: Question): Promise<Result<void, string>>;
  updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>>;
  deleteQuestion(questionId: string): Promise<Result<void, string>>;

  // Answer operations
  createAnswer(answer: Answer): Promise<Result<Answer, string>>;
  getAnswerById(answerId: string): Promise<Result<Answer | null, string>>;
  getAnswersByQuestionId(questionId: string): Promise<Result<Answer[], string>>;
  updateAnswer(answer: Answer): Promise<Result<void, string>>;
  deleteAnswer(answerId: string): Promise<Result<void, string>>;

  // Vote operations
  createVote(vote: Vote): Promise<Result<Vote, string>>;
  createVotes(votes: Vote[]): Promise<Result<void, string>>;
  getUserVotes(pollId: string, userId: string): Promise<Result<Vote[], string>>;
  hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>>;
  getVotesByPoll(pollId: string): Promise<Result<Vote[], string>>;

  // Participant operations
  createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>>;
  getParticipants(pollId: string): Promise<Result<PollParticipant[], string>>;
  getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>>;
  getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>>;
  updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>>;
  deleteParticipant(participantId: string): Promise<Result<void, string>>;

  // Weight history operations
  createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>>;
  getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>>;
  getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>>;

  // Draft operations
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
