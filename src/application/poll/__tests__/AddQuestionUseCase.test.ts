import { describe, it, expect, beforeEach } from 'vitest';
import { AddQuestionUseCase } from '../AddQuestionUseCase';
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

// Mock PollRepository (same as before)
class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer> = new Map();
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

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    const id = `question-${this.nextId++}`;
    (question as any).props.id = id;
    this.questions.set(id, question);

    // Add question to poll
    const poll = this.polls.get(question.pollId);
    if (poll) {
      poll.addQuestion(question);
    }

    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    const question = this.questions.get(questionId);
    if (!question) {
      return success(null);
    }

    // Get all answers for this question and add them
    const answers = Array.from(this.answers.values()).filter(
      (a) => a.questionId === questionId && !a.isArchived()
    );

    // Create a new question instance with answers
    const questionWithAnswers = Question.reconstitute({
      id: question.id,
      text: question.text,
      details: question.details,
      pollId: question.pollId,
      page: question.page,
      order: question.order,
      questionType: question.questionType,
      createdAt: question.createdAt,
      archivedAt: question.archivedAt,
      answers: answers.sort((a, b) => a.order - b.order),
    });

    return success(questionWithAnswers);
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

  addPoll(poll: Poll): void {
    this.polls.set(poll.id, poll);
  }

  clear(): void {
    this.polls.clear();
    this.questions.clear();
    this.answers.clear();
    this.nextId = 1;
  }
}

describe('AddQuestionUseCase', () => {
  let useCase: AddQuestionUseCase;
  let pollRepository: MockPollRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    useCase = new AddQuestionUseCase(pollRepository);
  });

  it('should add a question with answers to a poll', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    pollRepository.addPoll(poll);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: 'What is your favorite color?',
      details: 'Please select one option',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.text).toBe('What is your favorite color?');
      expect(result.value.details).toBe('Please select one option');
      expect(result.value.page).toBe(1);
      expect(result.value.order).toBe(0);
      expect(result.value.questionType).toBe('single-choice');
      expect(result.value.answers).toHaveLength(3);
      expect(result.value.answers[0].text).toBe('Red');
      expect(result.value.answers[1].text).toBe('Green');
      expect(result.value.answers[2].text).toBe('Blue');
    }
  });

  it('should add a multiple-choice question', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    pollRepository.addPoll(poll);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: 'What features do you want?',
      page: 1,
      order: 0,
      questionType: 'multiple-choice',
      answers: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.questionType).toBe('multiple-choice');
      expect(result.value.answers).toHaveLength(4);
    }
  });

  it('should fail when poll does not exist', async () => {
    // Act
    const result = await useCase.execute({
      pollId: 'non-existent-poll',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should fail when question text is empty', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    pollRepository.addPoll(poll);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: '',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.QUESTION_TEXT_EMPTY);
    }
  });

  it('should fail when no answers are provided', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    pollRepository.addPoll(poll);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: [],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NO_ANSWERS);
    }
  });

  it('should fail when poll is finished', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    poll.finish();
    pollRepository.addPoll(poll);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    }
  });

  it('should handle questions on different pages', async () => {
    // Arrange
    const pollResult = Poll.create(
      'Test Poll',
      'Description',
      'board-1',
      'user-1',
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    expect(pollResult.success).toBe(true);
    const poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    pollRepository.addPoll(poll);

    // Act - Add question on page 2
    const result = await useCase.execute({
      pollId: 'poll-1',
      text: 'Second page question',
      page: 2,
      order: 0,
      questionType: 'single-choice',
      answers: ['Option 1', 'Option 2'],
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.page).toBe(2);
    }
  });
});
