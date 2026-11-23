/** Application client regressions exercise typed question/answer creation and editing.
 * Raw requests remain transport values; fixtures supply deterministic identity/time. */
import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
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

import { describe, it, expect, beforeEach } from 'vitest';
import { UpdateAnswerUseCase } from '../UpdateAnswerUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { QuestionRepository } from '../../../domain/poll/QuestionRepository';
import { AnswerRepository } from '../../../domain/poll/AnswerRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';

// Mock PollRepository - only poll operations needed
class MockPollRepository implements Partial<PollRepository> {
  private polls: Map<string, Poll> = new Map();

  async getPollById(pollId: string): ReturnType<PollRepository['getPollById']> {
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
  ): ReturnType<QuestionRepository['getQuestionById']> {
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

  async getAnswerById(
    answerId: string
  ): ReturnType<AnswerRepository['getAnswerById']> {
    return success(this.answers.get(answerId) || null);
  }

  async updateAnswer(
    answer: Answer
  ): ReturnType<AnswerRepository['updateAnswer']> {
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

  async pollHasVotes(
    pollId: string
  ): ReturnType<VoteRepository['pollHasVotes']> {
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

describe('UpdateAnswerUseCase', () => {
  let useCase: UpdateAnswerUseCase;
  let pollRepository: MockPollRepository;
  let questionRepository: MockQuestionRepository;
  let answerRepository: MockAnswerRepository;
  let voteRepository: MockVoteRepository;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    questionRepository = new MockQuestionRepository();
    answerRepository = new MockAnswerRepository();
    voteRepository = new MockVoteRepository();
    userRepository = new MockUserRepository();
    useCase = new UpdateAnswerUseCase(
      pollRepository as unknown as PollRepository,
      questionRepository as unknown as QuestionRepository,
      answerRepository as unknown as AnswerRepository,
      voteRepository as unknown as VoteRepository,
      userRepository as unknown as UserRepository
    );
  });

  describe('updating answer text', () => {
    it('should update answer text when user is poll creator and poll is editable', async () => {
      // Create a poll
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      // Create a question
      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      // Create an answer
      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
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
      const updatedAnswer = expectSuccess(updatedAnswerResult)!;
      expect(updatedAnswer.text).toBe('Updated Answer');
    });

    it('should fail when answer not found', async () => {
      const result = await useCase.execute({
        answerId: 'non-existent',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.ANSWER_NOT_FOUND);
    });

    it('should fail when user is not poll creator', async () => {
      // Create poll, question, and answer
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      // Try to update with different user
      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-2',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });

    it('should fail when poll is active', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      );
      let poll = expectSuccess(pollResult);
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        id: 'poll-1',
      });

      // Activate poll (need question with answer)
      const questionForActivation = Question.create(
        QuestionText.parse('Temp Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const tempAnswer = Answer.create(
        AnswerText.parse('Temp Answer'),
        SortOrder.parse(1),
        expectSuccess(questionForActivation).id,
        testCreation(AnswerId, 'answer-1')
      );
      expectSuccess(questionForActivation).addAnswer(expectSuccess(tempAnswer));
      poll.addQuestion(expectSuccess(questionForActivation));
      poll.submitToAdmin();
      poll.takeSnapshot();
      poll.activate();

      pollRepository.addPoll(poll);

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_ACTIVE);
    });

    it('should fail when poll has votes', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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
      voteRepository.addVoteToPoll('poll-1');

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        text: 'Updated Answer',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.CANNOT_MODIFY_HAS_VOTES);
    });
  });

  describe('updating answer order', () => {
    it('should update answer order', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-1',
        order: 5,
      });

      expect(result.success).toBe(true);

      const updatedAnswerResult =
        await answerRepository.getAnswerById('answer-1');
      const updatedAnswer = expectSuccess(updatedAnswerResult)!;
      expect(updatedAnswer.order).toBe(5);
    });
  });

  describe('updating text and order together', () => {
    it('should update both text and order', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
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
      const updatedAnswer = expectSuccess(updatedAnswerResult)!;
      expect(updatedAnswer.text).toBe('Updated Answer');
      expect(updatedAnswer.order).toBe(3);
    });
  });

  describe('superadmin authorization', () => {
    it('should allow superadmin (not creator) to update answer', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      userRepository.setSuperAdmin('superadmin-1');

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'superadmin-1',
        text: 'Updated by superadmin',
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-creator non-superadmin', async () => {
      const pollResult = Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        BoardId.parse('board-1'),
        UserId.parse('user-1'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
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

      const questionResult = Question.create(
        QuestionText.parse('Test Question'),
        PollId.parse('poll-1'),
        testCreation(QuestionId, 'question-1'),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      );
      const question = expectSuccess(questionResult);
      questionRepository.addQuestion(question);

      const answerResult = Answer.create(
        AnswerText.parse('Original Answer'),
        SortOrder.parse(0),
        QuestionId.parse('question-1'),
        testCreation(AnswerId, 'answer-1')
      );
      const answer = expectSuccess(answerResult);
      answerRepository.addAnswer(answer);

      const result = await useCase.execute({
        answerId: 'answer-1',
        userId: 'user-2',
        text: 'Updated by stranger',
      });

      expect(result.success).toBe(false);
      expect(expectFailure(result)).toBe(PollErrors.NOT_POLL_CREATOR);
    });
  });
});
