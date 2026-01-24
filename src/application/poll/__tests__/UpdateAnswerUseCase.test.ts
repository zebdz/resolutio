import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateAnswerUseCase } from '../UpdateAnswerUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

// Mock PollRepository - only poll operations needed
class MockPollRepository implements Partial<PollRepository> {
  private polls: Map<string, Poll> = new Map();

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    return success(this.polls.get(pollId) || null);
  }

  async pollHasVotes(_pollId: string): Promise<Result<boolean, string>> {
    return success(false);
  }

  // Test helper methods
  addPoll(poll: Poll): void {
    this.polls.set(poll.id, poll);
  }

  clear(): void {
    this.polls.clear();
  }
}

// Mock QuestionRepository
class MockQuestionRepository implements Partial<QuestionRepository> {
  private questions: Map<string, Question> = new Map();

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    return success(this.questions.get(questionId) || null);
  }

  // Test helper methods
  addQuestion(question: Question): void {
    this.questions.set(question.id, question);
  }

  clear(): void {
    this.questions.clear();
  }
}

// Mock AnswerRepository
class MockAnswerRepository implements Partial<AnswerRepository> {
  private answers: Map<string, Answer> = new Map();

  async getAnswerById(answerId: string): Promise<Result<Answer | null, string>> {
    return success(this.answers.get(answerId) || null);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    this.answers.set(answer.id, answer);
    return success(undefined);
  }

  // Test helper methods
  addAnswer(answer: Answer): void {
    this.answers.set(answer.id, answer);
  }

  clear(): void {
    this.answers.clear();
  }
}

// Mock VoteRepository
class MockVoteRepository implements Partial<VoteRepository> {
  private votes: Set<string> = new Set();

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(this.votes.has(pollId));
  }

  // Test helper methods
  addVoteToPoll(pollId: string): void {
    this.votes.add(pollId);
  }

  clear(): void {
    this.votes.clear();
  }
}

describe('UpdateAnswerUseCase', () => {
  let useCase: UpdateAnswerUseCase;
  let pollRepository: MockPollRepository;
  let questionRepository: MockQuestionRepository;
  let answerRepository: MockAnswerRepository;
  let voteRepository: MockVoteRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    questionRepository = new MockQuestionRepository();
    answerRepository = new MockAnswerRepository();
    voteRepository = new MockVoteRepository();
    useCase = new UpdateAnswerUseCase(
      pollRepository as unknown as PollRepository,
      questionRepository as unknown as QuestionRepository,
      answerRepository as unknown as AnswerRepository,
      voteRepository as unknown as VoteRepository
    );
  });

  describe('updating answer text', () => {
    it('should update answer text when user is poll creator and poll is editable', async () => {
      // Create a poll
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      // Create a question
      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      // Create an answer
      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      // Update answer
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(true);

      // Verify answer was updated
      const updatedAnswerResult =
        await answerRepository.getAnswerById('answer-1');
      expect(updatedAnswerResult.success).toBe(true);
      const updatedAnswer = updatedAnswerResult.value!;
      expect(updatedAnswer.text).toBe('Updated Answer');
    });

    it('should fail when answer not found', async () => {
      const result = await useCase.execute({
        answerId: 'non-existent',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.ANSWER_NOT_FOUND);
    });

    it('should fail when user is not poll creator', async () => {
      // Create poll, question, and answer
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      // Try to update with different user
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-2',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';

      // Activate poll (need question with answer)
      const questionForActivation = Question.create(
        'Temp Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const tempAnswer = Answer.create(
        'Temp Answer',
        1,
        questionForActivation.value.id
      );
      questionForActivation.value.addAnswer(tempAnswer.value);
      poll.addQuestion(questionForActivation.value);
      poll.activate();

      pollRepository.addPoll(poll);

      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll has votes', async () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);
      voteRepository.addVoteToPoll('poll-1');

      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });

  describe('updating answer order', () => {
    it('should update answer order', async () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        order: 5,
      });

      expect(result.success).toBe(true);

      const updatedAnswerResult =
        await answerRepository.getAnswerById('answer-1');
      const updatedAnswer = updatedAnswerResult.value!;
      expect(updatedAnswer.order).toBe(5);
    });
  });

  describe('updating text and order together', () => {
    it('should update both text and order', async () => {
      const pollResult = Poll.create(
        'Test Poll',
        'Test Description',
        'board-1',
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15')
      );
      const poll = pollResult.value;
      (poll as any).props.id = 'poll-1';
      pollRepository.addPoll(poll);

      const questionResult = Question.create(
        'Test Question',
        'poll-1',
        1,
        0,
        'single-choice'
      );
      const question = questionResult.value;
      (question as any).props.id = 'question-1';
      questionRepository.addQuestion(question);

      const answerResult = Answer.create('Original Answer', 0, 'question-1');
      const answer = answerResult.value;
      (answer as any).props.id = 'answer-1';
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
        order: 3,
      });

      expect(result.success).toBe(true);

      const updatedAnswerResult =
        await answerRepository.getAnswerById('answer-1');
      const updatedAnswer = updatedAnswerResult.value!;
      expect(updatedAnswer.text).toBe('Updated Answer');
      expect(updatedAnswer.order).toBe(3);
    });
  });
});
