import { describe, it, expect, beforeEach } from 'vitest';
import { UpdatePollUseCase } from '../UpdatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

// Mock PollRepository
class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer> = new Map();
  private votes: Set<string> = new Set(); // pollIds that have votes
  private nextId = 1;

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    const id = `poll-${this.nextId++}`;
    (poll as any).props.id = id;
    this.polls.set(id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
    const polls = Array.from(this.polls.values()).filter(
      (p) => p.boardId === boardId && !p.isArchived()
    );

    return success(polls);
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    return success(Array.from(this.polls.values()));
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    poll.archive();

    return success(undefined);
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(this.votes.has(pollId));
  }

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    const id = `question-${this.nextId++}`;
    (question as any).props.id = id;
    this.questions.set(id, question);

    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    return success(this.questions.get(questionId) || null);
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    const questions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId && !q.isArchived()
    );

    return success(questions);
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    this.questions.set(question.id, question);

    return success(undefined);
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    for (const update of updates) {
      const question = this.questions.get(update.questionId);
      if (question) {
        question.updatePage(update.page);
        question.updateOrder(update.order);
      }
    }

    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    const question = this.questions.get(questionId);
    if (!question) {
      return failure(PollErrors.QUESTION_NOT_FOUND);
    }

    question.archive();

    return success(undefined);
  }

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    const id = `answer-${this.nextId++}`;
    (answer as any).props.id = id;
    this.answers.set(id, answer);

    return success(answer);
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    return success(this.answers.get(answerId) || null);
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    const answers = Array.from(this.answers.values()).filter(
      (a) => a.questionId === questionId && !a.isArchived()
    );

    return success(answers);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    this.answers.set(answer.id, answer);

    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    const answer = this.answers.get(answerId);
    if (!answer) {
      return failure(PollErrors.ANSWER_NOT_FOUND);
    }

    answer.archive();

    return success(undefined);
  }

  // Test helper methods
  addPoll(poll: Poll): void {
    this.polls.set(poll.id, poll);
  }

  addQuestion(question: Question): void {
    this.questions.set(question.id, question);
  }

  addAnswer(answer: Answer): void {
    this.answers.set(answer.id, answer);
  }

  addVoteToPoll(pollId: string): void {
    this.votes.add(pollId);
  }

  clear(): void {
    this.polls.clear();
    this.questions.clear();
    this.answers.clear();
    this.votes.clear();
    this.nextId = 1;
  }
}

describe('UpdatePollUseCase', () => {
  let useCase: UpdatePollUseCase;
  let pollRepository: MockPollRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    useCase = new UpdatePollUseCase(pollRepository);
  });

  describe('updatePollBasicInfo', () => {
    it('should update poll basic info when user is creator and poll is not active/finished/has votes', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Original Title',
        'Original Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      expect(pollResult.success).toBe(true);
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      // Update poll
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(true);

      // Verify poll was updated
      const updatedPollResult = await pollRepository.getPollById('poll-1');
      expect(updatedPollResult.success).toBe(true);
      const updatedPoll = updatedPollResult.value!;
      expect(updatedPoll.title).toBe('Updated Title');
      expect(updatedPoll.description).toBe('Updated Description');
    });

    it('should fail when poll not found', async () => {
      const result = await useCase.execute({
        pollId: 'non-existent',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    });

    it('should fail when user is not the poll creator', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Original Title',
        'Original Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      // Try to update with different user
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-2',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Original Title',
        'Original Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';

      // Add a question and activate poll
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      poll.addQuestion(questionResult.value);
      poll.activate();

      pollRepository.addPoll(poll);

      // Try to update
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll is finished', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Original Title',
        'Original Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      poll.finish();

      pollRepository.addPoll(poll);

      // Try to update
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    });

    it('should fail when poll has votes', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Original Title',
        'Original Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );

      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      // Add a vote to the poll
      pollRepository.addVoteToPoll('poll-1');

      // Try to update
      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-1',
        title: 'Updated Title',
        description: 'Updated Description',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-02-20'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });
});
