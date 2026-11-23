import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { PollInstant } from '@/domain/poll/PollValues';
import { AnswerText, QuestionText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { ResultCount } from '@/domain/shared/Pagination';
/** Application client regressions exercise typed question/answer creation and editing.
 * Raw requests remain transport values; fixtures supply deterministic identity/time. */
import { UserId } from '@/domain/shared/EntityIds';
import { BoardId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import {
  expectSuccess,
  expectFailure,
} from '@/domain/shared/__tests__/resultAssertions';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { PollId } from '@/domain/shared/EntityIds';
import { QuestionId, AnswerId } from '@/domain/shared/EntityIds';
import { createQuestionIds, questionClock } from './questionTestValues';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddQuestionUseCase } from '../AddQuestionUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import {
  QuestionRepository,
  QuestionRepositoryFailure,
  UpdateQuestionOrderData,
} from '../../../domain/poll/QuestionRepository';
import {
  AnswerRepository,
  AnswerRepositoryFailure,
} from '../../../domain/poll/AnswerRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';

// Mock PollRepository
class MockPollRepository implements PollRepository {
  async searchPolls(): ReturnType<PollRepository['searchPolls']> {
    return success({ polls: [], totalCount: ResultCount.parse(0) });
  }

  private polls: Map<string, Poll> = new Map();

  async createPoll(poll: Poll): ReturnType<PollRepository['createPoll']> {
    const id = poll.id;
    this.polls.set(id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): ReturnType<PollRepository['getPollById']> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(
    boardId: string
  ): ReturnType<PollRepository['getPollsByBoardId']> {
    return success(
      Array.from(this.polls.values()).filter((p) => p.boardId === boardId)
    );
  }

  async getPollsByOrganizationId(
    orgId: string
  ): ReturnType<PollRepository['getPollsByOrganizationId']> {
    return success([]);
  }

  async getPollsByUserId(
    userId: string
  ): ReturnType<PollRepository['getPollsByUserId']> {
    return success(Array.from(this.polls.values()));
  }

  async updatePoll(poll: Poll): Promise<Result<void, never>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): Promise<Result<void, never>> {
    const poll = this.polls.get(pollId);

    if (poll) {
      poll.archive(questionClock.now());
    }

    return success(undefined);
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(false);
  }

  addPoll(poll: Poll): void {
    this.polls.set(poll.id, poll);
  }

  clear(): void {
    this.polls.clear();
  }
}

// Mock QuestionRepository
class MockQuestionRepository implements QuestionRepository {
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer[]> = new Map();

  async createQuestion(
    question: Question
  ): Promise<Result<Question, QuestionRepositoryFailure>> {
    const id = question.id;
    this.questions.set(id, question);

    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, QuestionRepositoryFailure>> {
    const question = this.questions.get(questionId);

    if (!question) {
      return success(null);
    }

    const answers = this.answers.get(questionId) || [];

    return success(
      Question.reconstitute({
        id: question.id,
        text: question.text,
        details: question.details,
        pollId: question.pollId,
        page: question.page,
        order: question.order,
        questionType: question.questionType,
        createdAt: question.createdAt,
        archivedAt: question.archivedAt,
        answers: answers.filter((a) => !a.isArchived()),
      })
    );
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], QuestionRepositoryFailure>> {
    return success(
      Array.from(this.questions.values()).filter(
        (q) => q.pollId === pollId && !q.isArchived()
      )
    );
  }

  async updateQuestion(question: Question): Promise<Result<void, never>> {
    this.questions.set(question.id, question);

    return success(undefined);
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, never>> {
    for (const update of updates) {
      const question = this.questions.get(update.questionId);

      if (question) {
        question.updatePage(update.page);
        question.updateOrder(update.order);
      }
    }

    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, never>> {
    const question = this.questions.get(questionId);

    if (question) {
      question.archive(questionClock.now());
    }

    return success(undefined);
  }

  addAnswerToQuestion(questionId: string, answer: Answer): void {
    const existing = this.answers.get(questionId) || [];
    existing.push(answer);
    this.answers.set(questionId, existing);
  }

  clear(): void {
    this.questions.clear();
    this.answers.clear();
  }
}

// Mock AnswerRepository
class MockAnswerRepository implements AnswerRepository {
  private answers: Map<string, Answer> = new Map();
  private questionRepository: MockQuestionRepository;

  constructor(questionRepository: MockQuestionRepository) {
    this.questionRepository = questionRepository;
  }

  async createAnswer(
    answer: Answer
  ): Promise<Result<Answer, AnswerRepositoryFailure>> {
    const id = answer.id;
    this.answers.set(id, answer);
    this.questionRepository.addAnswerToQuestion(answer.questionId, answer);

    return success(answer);
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, AnswerRepositoryFailure>> {
    return success(this.answers.get(answerId) || null);
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], AnswerRepositoryFailure>> {
    return success(
      Array.from(this.answers.values()).filter(
        (a) => a.questionId === questionId && !a.isArchived()
      )
    );
  }

  async updateAnswer(answer: Answer): Promise<Result<void, never>> {
    this.answers.set(answer.id, answer);

    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, never>> {
    const answer = this.answers.get(answerId);

    if (answer) {
      answer.archive(questionClock.now());
    }

    return success(undefined);
  }

  clear(): void {
    this.answers.clear();
  }
}

// Mock UserRepository
class MockUserRepository implements Partial<UserRepository> {
  private superAdmins: Set<string> = new Set();

  setSuperAdmin(userId: string): void {
    this.superAdmins.add(userId);
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    return this.superAdmins.has(userId);
  }
}

describe('AddQuestionUseCase', () => {
  let useCase: AddQuestionUseCase;
  let pollRepository: MockPollRepository;
  let questionRepository: MockQuestionRepository;
  let answerRepository: MockAnswerRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    questionRepository = new MockQuestionRepository();
    answerRepository = new MockAnswerRepository(questionRepository);
    userRepository = new MockUserRepository();
    useCase = new AddQuestionUseCase(
      pollRepository,
      questionRepository,
      answerRepository,
      userRepository as unknown as UserRepository,
      createQuestionIds(),
      questionClock
    );
  });

  it('should add a question with answers to a poll', async () => {
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'What is your favorite color?',
      details: 'Please select one option',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

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
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'What features do you want?',
      page: 1,
      order: 0,
      questionType: 'multiple-choice',
      answers: ['Feature A', 'Feature B', 'Feature C', 'Feature D'],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.questionType).toBe('multiple-choice');
      expect(result.value.answers).toHaveLength(4);
    }
  });

  it('should fail when poll does not exist', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent-poll',
      userId: 'user-1',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should fail when question text is empty', async () => {
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: '',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.QUESTION_TEXT_EMPTY);
    }
  });

  it('should fail when no answers are provided', async () => {
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: [],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NO_ANSWERS);
    }
  });

  it('should fail when poll is finished', async () => {
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });

    // Add question with answer so we can transition through states
    const questionResult = Question.create(
      QuestionText.parse('Q1'),
      poll.id,
      testCreation(QuestionId, 'question-1'),
      PageNumber.parse(1),
      SortOrder.parse(1),
      'single-choice'
    );
    const question = expectSuccess(questionResult);
    const answerResult = Answer.create(
      AnswerText.parse('A1'),
      SortOrder.parse(1),
      question.id,
      testCreation(AnswerId, 'answer-1')
    );
    question.addAnswer(expectSuccess(answerResult));
    poll.addQuestion(question);

    // Transition to FINISHED state
    poll.submitToAdmin();
    poll.takeSnapshot();
    poll.activate();
    poll.finish(PollInstant.parse(new Date().toISOString()));

    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'What is your favorite color?',
      page: 1,
      order: 0,
      questionType: 'single-choice',
      answers: ['Red', 'Green', 'Blue'],
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.CANNOT_MODIFY_FINISHED);
    }
  });

  it('should handle questions on different pages', async () => {
    const pollResult = Poll.create(
      PollTitle.parse('Test Poll'),
      PollDescription.parse('Description'),
      OrganizationId.parse('org-1'),
      BoardId.parse('board-1'),
      UserId.parse('user-1'),
      expectSuccess(
        PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
      ),
      testCreation(PollId, 'poll-1')
    );
    expect(pollResult.success).toBe(true);
    let poll = expectSuccess(pollResult);
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    pollRepository.addPoll(poll);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1',
      text: 'Second page question',
      page: 2,
      order: 0,
      questionType: 'single-choice',
      answers: ['Option 1', 'Option 2'],
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.page).toBe(2);
    }
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to add question', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
        ),
        testCreation(PollId, 'poll-1')
      );
      let poll = expectSuccess(pollResult);
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: 'poll-1',
      });
      pollRepository.addPoll(poll);
      userRepository.setSuperAdmin('superadmin-1');

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'superadmin-1',
        text: 'Question from superadmin',
        page: 1,
        order: 0,
        questionType: 'single-choice',
        answers: ['A', 'B'],
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-creator non-superadmin', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2025-01-01'), new Date('2025-12-31'))
        ),
        testCreation(PollId, 'poll-1')
      );
      let poll = expectSuccess(pollResult);
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: 'poll-1',
      });
      pollRepository.addPoll(poll);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'user-2',
        text: 'Question from stranger',
        page: 1,
        order: 0,
        questionType: 'single-choice',
        answers: ['A', 'B'],
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });
  });
});
