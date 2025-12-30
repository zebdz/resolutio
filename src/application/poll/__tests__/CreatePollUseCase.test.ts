import { describe, it, expect, beforeEach } from 'vitest';
import { CreatePollUseCase } from '../CreatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Board } from '../../../domain/board/Board';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';

// Mock PollRepository
class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer> = new Map();
  private nextId = 1;

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    const id = `poll-${this.nextId++}`;
    // Use reflection to set the id
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

  clear(): void {
    this.polls.clear();
    this.questions.clear();
    this.answers.clear();
    this.nextId = 1;
  }
}

// Mock BoardRepository
class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private members: Map<string, Set<string>> = new Map(); // boardId -> Set of userIds

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter(
      (b) => b.organizationId === organizationId
    );
  }

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    return (
      Array.from(this.boards.values()).find(
        (b) => b.organizationId === organizationId && b.isGeneral
      ) || null
    );
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    return this.members.get(boardId)?.has(userId) || false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void> {
    if (!this.members.has(boardId)) {
      this.members.set(boardId, new Set());
    }
    this.members.get(boardId)!.add(userId);
  }

  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {
    this.members.get(boardId)?.delete(userId);
  }

  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  addBoard(board: Board): void {
    this.boards.set(board.id, board);
  }

  clear(): void {
    this.boards.clear();
    this.members.clear();
  }
}

describe('CreatePollUseCase', () => {
  let useCase: CreatePollUseCase;
  let pollRepository: MockPollRepository;
  let boardRepository: MockBoardRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    boardRepository = new MockBoardRepository();
    useCase = new CreatePollUseCase(pollRepository, boardRepository);
  });

  it('should create a poll when user is a board member', async () => {
    // Arrange
    const boardResult = Board.create('Test Board', 'org-1', false);
    expect(boardResult.success).toBe(true);
    const board = boardResult.value;
    (board as any).props.id = 'board-1';
    boardRepository.addBoard(board);
    await boardRepository.addUserToBoard('user-1', 'board-1');

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    // Act
    const result = await useCase.execute({
      title: 'Test Poll',
      description: 'This is a test poll',
      boardId: 'board-1',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.title).toBe('Test Poll');
      expect(result.value.description).toBe('This is a test poll');
      expect(result.value.boardId).toBe('board-1');
      expect(result.value.createdBy).toBe('user-1');
      expect(result.value.startDate).toEqual(startDate);
      expect(result.value.endDate).toEqual(endDate);
      expect(result.value.active).toBe(false);
      expect(result.value.finished).toBe(false);
    }
  });

  it('should fail when user is not a board member', async () => {
    // Arrange
    const boardResult = Board.create('Test Board', 'org-1', false);
    expect(boardResult.success).toBe(true);
    const board = boardResult.value;
    (board as any).props.id = 'board-1';
    boardRepository.addBoard(board);
    // Note: not adding user as member

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    // Act
    const result = await useCase.execute({
      title: 'Test Poll',
      description: 'This is a test poll',
      boardId: 'board-1',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_BOARD_MEMBER);
    }
  });

  it('should fail when board does not exist', async () => {
    // Arrange
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    // Act
    const result = await useCase.execute({
      title: 'Test Poll',
      description: 'This is a test poll',
      boardId: 'non-existent-board',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.BOARD_NOT_FOUND);
    }
  });

  it('should fail when title is empty', async () => {
    // Arrange
    const boardResult = Board.create('Test Board', 'org-1', false);
    expect(boardResult.success).toBe(true);
    const board = boardResult.value;
    (board as any).props.id = 'board-1';
    boardRepository.addBoard(board);
    await boardRepository.addUserToBoard('user-1', 'board-1');

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    // Act
    const result = await useCase.execute({
      title: '',
      description: 'This is a test poll',
      boardId: 'board-1',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('title');
    }
  });

  it('should fail when description is empty', async () => {
    // Arrange
    const boardResult = Board.create('Test Board', 'org-1', false);
    expect(boardResult.success).toBe(true);
    const board = boardResult.value;
    (board as any).props.id = 'board-1';
    boardRepository.addBoard(board);
    await boardRepository.addUserToBoard('user-1', 'board-1');

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    // Act
    const result = await useCase.execute({
      title: 'Test Poll',
      description: '',
      boardId: 'board-1',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('description');
    }
  });

  it('should fail when start date is after end date', async () => {
    // Arrange
    const boardResult = Board.create('Test Board', 'org-1', false);
    expect(boardResult.success).toBe(true);
    const board = boardResult.value;
    (board as any).props.id = 'board-1';
    boardRepository.addBoard(board);
    await boardRepository.addUserToBoard('user-1', 'board-1');

    const startDate = new Date('2025-12-31');
    const endDate = new Date('2025-01-01');

    // Act
    const result = await useCase.execute({
      title: 'Test Poll',
      description: 'This is a test poll',
      boardId: 'board-1',
      createdBy: 'user-1',
      startDate,
      endDate,
    });

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_INVALID_DATES);
    }
  });
});
