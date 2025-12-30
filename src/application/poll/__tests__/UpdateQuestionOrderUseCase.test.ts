import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateQuestionOrderUseCase } from '../UpdateQuestionOrderUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

// Mock PollRepository (reusing from previous tests)
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
    const questions = Array.from(this.questions.values())
      .filter((q) => q.pollId === pollId && !q.isArchived())
      .sort((a, b) => {
        if (a.page !== b.page) {
          return a.page - b.page;
        }

        return a.order - b.order;
      });

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
        this.questions.set(question.id, question);
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

  addQuestion(question: Question): void {
    this.questions.set(question.id, question);
  }

  clear(): void {
    this.polls.clear();
    this.questions.clear();
    this.answers.clear();
    this.nextId = 1;
  }
}

describe('UpdateQuestionOrderUseCase', () => {
  let useCase: UpdateQuestionOrderUseCase;
  let pollRepository: MockPollRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    useCase = new UpdateQuestionOrderUseCase(pollRepository);
  });

  it('should reorder questions within the same page', async () => {
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

    // Create questions on page 1
    const q1 = Question.create(
      'Question 1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (q1 as any).props.id = 'q-1';
    pollRepository.addQuestion(q1);

    const q2 = Question.create(
      'Question 2',
      'poll-1',
      1,
      1,
      'single-choice'
    ).value;
    (q2 as any).props.id = 'q-2';
    pollRepository.addQuestion(q2);

    const q3 = Question.create(
      'Question 3',
      'poll-1',
      1,
      2,
      'single-choice'
    ).value;
    (q3 as any).props.id = 'q-3';
    pollRepository.addQuestion(q3);

    // Act - Move question 3 to position 0
    const result = await useCase.execute({
      pollId: 'poll-1',
      updates: [
        { questionId: 'q-3', page: 1, order: 0 },
        { questionId: 'q-1', page: 1, order: 1 },
        { questionId: 'q-2', page: 1, order: 2 },
      ],
    });

    // Assert
    expect(result.success).toBe(true);
    const questionsResult = await pollRepository.getQuestionsByPollId('poll-1');
    expect(questionsResult.success).toBe(true);
    if (questionsResult.success) {
      const questions = questionsResult.value;
      expect(questions[0].id).toBe('q-3');
      expect(questions[1].id).toBe('q-1');
      expect(questions[2].id).toBe('q-2');
    }
  });

  it('should move question to a different page', async () => {
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

    // Create questions on page 1
    const q1 = Question.create(
      'Question 1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (q1 as any).props.id = 'q-1';
    pollRepository.addQuestion(q1);

    const q2 = Question.create(
      'Question 2',
      'poll-1',
      1,
      1,
      'single-choice'
    ).value;
    (q2 as any).props.id = 'q-2';
    pollRepository.addQuestion(q2);

    // Create question on page 2
    const q3 = Question.create(
      'Question 3',
      'poll-1',
      2,
      0,
      'single-choice'
    ).value;
    (q3 as any).props.id = 'q-3';
    pollRepository.addQuestion(q3);

    // Act - Move question 2 from page 1 to page 2
    const result = await useCase.execute({
      pollId: 'poll-1',
      updates: [
        { questionId: 'q-2', page: 2, order: 0 },
        { questionId: 'q-3', page: 2, order: 1 },
      ],
    });

    // Assert
    expect(result.success).toBe(true);
    const q2Updated = await pollRepository.getQuestionById('q-2');
    expect(q2Updated.success).toBe(true);
    if (q2Updated.success && q2Updated.value) {
      expect(q2Updated.value.page).toBe(2);
      expect(q2Updated.value.order).toBe(0);
    }
  });

  it('should fail when poll does not exist', async () => {
    // Act
    const result = await useCase.execute({
      pollId: 'non-existent-poll',
      updates: [{ questionId: 'q-1', page: 1, order: 0 }],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
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

    const q1 = Question.create(
      'Question 1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (q1 as any).props.id = 'q-1';
    pollRepository.addQuestion(q1);

    // Act
    const result = await useCase.execute({
      pollId: 'poll-1',
      updates: [{ questionId: 'q-1', page: 1, order: 1 }],
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    }
  });

  it('should handle complex reordering across multiple pages', async () => {
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

    // Page 1: Q1, Q2, Q3
    const q1 = Question.create(
      'Question 1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (q1 as any).props.id = 'q-1';
    pollRepository.addQuestion(q1);

    const q2 = Question.create(
      'Question 2',
      'poll-1',
      1,
      1,
      'single-choice'
    ).value;
    (q2 as any).props.id = 'q-2';
    pollRepository.addQuestion(q2);

    const q3 = Question.create(
      'Question 3',
      'poll-1',
      1,
      2,
      'single-choice'
    ).value;
    (q3 as any).props.id = 'q-3';
    pollRepository.addQuestion(q3);

    // Page 2: Q4, Q5
    const q4 = Question.create(
      'Question 4',
      'poll-1',
      2,
      0,
      'single-choice'
    ).value;
    (q4 as any).props.id = 'q-4';
    pollRepository.addQuestion(q4);

    const q5 = Question.create(
      'Question 5',
      'poll-1',
      2,
      1,
      'single-choice'
    ).value;
    (q5 as any).props.id = 'q-5';
    pollRepository.addQuestion(q5);

    // Act - Reorganize: Move Q2 to page 2, Q4 to page 1
    const result = await useCase.execute({
      pollId: 'poll-1',
      updates: [
        { questionId: 'q-1', page: 1, order: 0 },
        { questionId: 'q-4', page: 1, order: 1 }, // Moved from page 2
        { questionId: 'q-3', page: 1, order: 2 },
        { questionId: 'q-2', page: 2, order: 0 }, // Moved from page 1
        { questionId: 'q-5', page: 2, order: 1 },
      ],
    });

    // Assert
    expect(result.success).toBe(true);
    const questionsResult = await pollRepository.getQuestionsByPollId('poll-1');
    expect(questionsResult.success).toBe(true);
    if (questionsResult.success) {
      const questions = questionsResult.value;
      expect(questions).toHaveLength(5);
      // Page 1: Q1, Q4, Q3
      expect(questions[0].id).toBe('q-1');
      expect(questions[0].page).toBe(1);
      expect(questions[1].id).toBe('q-4');
      expect(questions[1].page).toBe(1);
      expect(questions[2].id).toBe('q-3');
      expect(questions[2].page).toBe(1);
      // Page 2: Q2, Q5
      expect(questions[3].id).toBe('q-2');
      expect(questions[3].page).toBe(2);
      expect(questions[4].id).toBe('q-5');
      expect(questions[4].page).toBe(2);
    }
  });
});
