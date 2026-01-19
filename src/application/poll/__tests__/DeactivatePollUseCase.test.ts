import { describe, it, expect, beforeEach } from 'vitest';
import { DeactivatePollUseCase } from '../DeactivatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Vote } from '../../../domain/poll/Vote';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';

class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    this.polls.set(poll.id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(false);
  }

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    return success(null);
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    return success([]);
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    return success(undefined);
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    return success(answer);
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    return success(null);
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    return success([]);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    return success(vote);
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    return success(false);
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    return success([]);
  }

  async getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteParticipant(
    participantId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>> {
    return success(history);
  }

  async getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    return success(draft);
  }

  async getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    return success([]);
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }
}

describe('DeactivatePollUseCase', () => {
  let repository: MockPollRepository;
  let useCase: DeactivatePollUseCase;
  let poll: Poll;

  beforeEach(() => {
    repository = new MockPollRepository();
    useCase = new DeactivatePollUseCase(repository);

    // Create a test poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'board-1',
      'user-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    expect(pollResult.success).toBe(true);
    if (pollResult.success) {
      poll = pollResult.value;
      (poll as any).props.id = 'poll-1';

      // Add a question
      const questionResult = Question.create(
        'Question 1',
        poll.id,
        1,
        1,
        'single-choice'
      );
      expect(questionResult.success).toBe(true);
      if (questionResult.success) {
        const question = questionResult.value;
        (question as any).props.id = 'question-1';
        poll.addQuestion(question);
      }

      // Activate the poll
      poll.activate();

      repository.createPoll(poll);
    }
  });

  it('should deactivate an active poll', async () => {
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Verify poll is deactivated
    const updatedPollResult = await repository.getPollById(poll.id);
    expect(updatedPollResult.success).toBe(true);
    if (updatedPollResult.success) {
      const updatedPoll = updatedPollResult.value!;
      expect(updatedPoll.active).toBe(false);
      expect(updatedPoll.finished).toBe(false);
    }
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if poll is already inactive', async () => {
    // Deactivate the poll first
    poll.deactivate();
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_ALREADY_INACTIVE);
  });

  it('should fail if poll is finished', async () => {
    // Finish the poll
    poll.finish();
    await repository.updatePoll(poll);

    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_CANNOT_DEACTIVATE_FINISHED);
  });
});
