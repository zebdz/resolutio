import { describe, it, expect, beforeEach } from 'vitest';
import { SubmitDraftUseCase } from '../SubmitDraftUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';
import { Decimal } from 'decimal.js';

// Mock PollRepository
class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer> = new Map();
  private participants: Map<string, PollParticipant> = new Map();
  private drafts: Map<string, VoteDraft> = new Map();
  private votes: Map<string, Vote> = new Map();
  private nextId = 1;

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    const id = `poll-${this.nextId++}`;
    (poll as any).props.id = id;
    this.polls.set(id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    const poll = this.polls.get(pollId);
    if (poll) {
      // Populate questions
      const questions = Array.from(this.questions.values()).filter(
        (q) => q.pollId === pollId
      );
      (poll as any).props.questions = questions;
    }

    return success(poll || null);
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

  async archivePoll(pollId: string): Promise<Result<void, string>> {
    const poll = this.polls.get(pollId);
    if (!poll) {
      return failure('Poll not found');
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
      (q) => q.pollId === pollId
    );

    return success(questions);
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    this.questions.set(question.id, question);

    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    this.questions.delete(questionId);

    return success(undefined);
  }

  async updateQuestionsOrder(
    data: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
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
      (a) => a.questionId === questionId
    );

    return success(answers);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    this.answers.set(answer.id, answer);

    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    this.answers.delete(answerId);

    return success(undefined);
  }

  // Voting methods
  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    this.votes.set(`${vote.userId}-${vote.answerId}`, vote);

    return success(vote);
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    for (const vote of votes) {
      this.votes.set(`${vote.userId}-${vote.answerId}`, vote);
    }

    return success(undefined);
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    return success(
      Array.from(this.votes.values()).filter(
        (v) => v.userId === userId && v.pollId === pollId
      )
    );
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    // Get all questions for this poll
    const pollQuestions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId
    );
    const questionIds = new Set(pollQuestions.map((q) => q.id));

    // Check if user has any votes for questions in this poll
    const votes = Array.from(this.votes.values()).filter(
      (v) => v.userId === userId && questionIds.has(v.questionId)
    );

    return success(votes.length > 0);
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    // Get all questions for this poll
    const pollQuestions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId
    );
    const questionIds = new Set(pollQuestions.map((q) => q.id));

    return success(
      Array.from(this.votes.values()).filter((v) =>
        questionIds.has(v.questionId)
      )
    );
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    const votes = Array.from(this.votes.values()).filter(
      (v) => v.pollId === pollId
    );

    return success(votes.length > 0);
  }

  // Participant methods
  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>> {
    for (const p of participants) {
      const id = `participant-${this.nextId++}`;
      (p as any).props.id = id;
      this.participants.set(id, p);
    }

    return success(undefined);
  }

  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    return success(
      Array.from(this.participants.values()).filter((p) => p.pollId === pollId)
    );
  }

  async getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(this.participants.get(participantId) || null);
  }

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    const participant = Array.from(this.participants.values()).find(
      (p) => p.userId === userId && p.pollId === pollId
    );

    return success(participant || null);
  }

  async updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>> {
    this.participants.set(participant.id, participant);

    return success(undefined);
  }

  async deleteParticipant(
    participantId: string
  ): Promise<Result<void, string>> {
    this.participants.delete(participantId);

    return success(undefined);
  }

  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  // Draft methods
  async saveDraft(draft: VoteDraft): Promise<Result<void, string>> {
    this.drafts.set(`${draft.userId}-${draft.answerId}`, draft);

    return success(undefined);
  }

  async getUserDrafts(
    userId: string,
    pollId: string
  ): Promise<Result<VoteDraft[], string>> {
    return success(
      Array.from(this.drafts.values()).filter(
        (d) => d.userId === userId && d.pollId === pollId
      )
    );
  }

  async deleteUserDrafts(
    userId: string,
    pollId: string
  ): Promise<Result<void, string>> {
    const toDelete: string[] = [];
    this.drafts.forEach((draft, key) => {
      if (draft.userId === userId && draft.pollId === pollId) {
        toDelete.push(key);
      }
    });
    toDelete.forEach((key) => this.drafts.delete(key));

    return success(undefined);
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    const toDelete: string[] = [];
    this.drafts.forEach((draft, key) => {
      if (draft.pollId === pollId) {
        toDelete.push(key);
      }
    });
    toDelete.forEach((key) => this.drafts.delete(key));

    return success(undefined);
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    const toDelete: string[] = [];
    this.drafts.forEach((draft, key) => {
      if (
        draft.userId === userId &&
        draft.questionId === questionId &&
        draft.pollId === pollId
      ) {
        toDelete.push(key);
      }
    });
    toDelete.forEach((key) => this.drafts.delete(key));

    return success(undefined);
  }

  async deleteDraftByAnswer(
    pollId: string,
    questionId: string,
    answerId: string,
    userId: string
  ): Promise<Result<void, string>> {
    const key = `${userId}-${answerId}`;
    this.drafts.delete(key);

    return success(undefined);
  }
}

describe('SubmitDraftUseCase', () => {
  let pollRepository: MockPollRepository;
  let useCase: SubmitDraftUseCase;
  let poll: Poll;
  let question: Question;
  let answer: Answer;
  let participant: PollParticipant;

  beforeEach(async () => {
    pollRepository = new MockPollRepository();
    useCase = new SubmitDraftUseCase(pollRepository);

    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'board-1',
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);
    if (pollResult.success) {
      poll = pollResult.value;
      await pollRepository.createPoll(poll);
    }

    // Create a question
    const questionResult = Question.create(
      'Test Question',
      poll.id,
      1,
      0,
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    if (questionResult.success) {
      question = questionResult.value;
      await pollRepository.createQuestion(question);
    }

    // Create an answer and add to question
    const answerResult = Answer.create('Test Answer', 1, question.id);
    expect(answerResult.success).toBe(true);
    if (answerResult.success) {
      answer = answerResult.value;
      question.addAnswer(answer);
      await pollRepository.createAnswer(answer);
    }

    // Add questions to poll and activate
    const questions = Array.from(pollRepository['questions'].values()).filter(
      (q: any) => q.pollId === poll.id
    );
    (poll as any).props.questions = questions;
    poll.activate();
    await pollRepository.updatePoll(poll);

    // Create a participant
    const participantResult = PollParticipant.create(
      poll.id,
      'user-1',
      new Decimal(1.0).toNumber()
    );
    expect(participantResult.success).toBe(true);
    if (participantResult.success) {
      participant = participantResult.value;
      await pollRepository.createParticipants([participant]);
    }

    // Take snapshot
    poll.takeParticipantsSnapshot();
    await pollRepository.updatePoll(poll);
  });

  it('should successfully save a draft', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);

    // Verify draft was saved
    const draftsResult = await pollRepository.getUserDrafts('user-1', poll.id);
    expect(draftsResult.success).toBe(true);
    if (draftsResult.success) {
      expect(draftsResult.value.length).toBe(1);
      expect(draftsResult.value[0].answerId).toBe(answer.id);
    }
  });

  it('should reject when poll not found', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: 'non-existent',
      questionId: question.id,
      answerId: answer.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should reject when poll not active', async () => {
    // Create inactive poll
    const inactivePollResult = Poll.create(
      'Inactive Poll',
      'Test Description',
      'board-1',
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(inactivePollResult.success).toBe(true);
    if (inactivePollResult.success) {
      const inactivePoll = inactivePollResult.value;
      await pollRepository.createPoll(inactivePoll);

      const result = await useCase.execute({
        userId: 'user-1',
        pollId: inactivePoll.id,
        questionId: question.id,
        answerId: answer.id,
        isSingleChoice: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.POLL_NOT_ACTIVE);
      }
    }
  });

  it('should reject when poll is finished', async () => {
    poll.finish();
    await pollRepository.updatePoll(poll);

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_FINISHED);
    }
  });

  it('should reject when user is not a participant', async () => {
    const result = await useCase.execute({
      userId: 'non-participant',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.NOT_PARTICIPANT);
    }
  });

  it('should reject when user has already voted', async () => {
    // Create a vote
    const voteResult = Vote.create(question.id, answer.id, 'user-1', 1.0);
    expect(voteResult.success).toBe(true);
    if (voteResult.success) {
      await pollRepository.createVote(voteResult.value);

      const result = await useCase.execute({
        userId: 'user-1',
        pollId: poll.id,
        questionId: question.id,
        answerId: answer.id,
        isSingleChoice: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
      }
    }
  });

  it('should delete existing drafts for single-choice questions', async () => {
    // Create an existing draft for a different answer
    const answer2Result = Answer.create(question.id, 'Answer 2', 2);
    expect(answer2Result.success).toBe(true);
    if (answer2Result.success) {
      const answer2 = answer2Result.value;
      await pollRepository.createAnswer(answer2);

      const draft1Result = VoteDraft.create(
        poll.id,
        'user-1',
        question.id,
        answer2.id
      );
      expect(draft1Result.success).toBe(true);
      if (draft1Result.success) {
        await pollRepository.saveDraft(draft1Result.value);
      }
    }

    // Submit new draft
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);

    // Verify only one draft exists
    const draftsResult = await pollRepository.getUserDrafts('user-1', poll.id);
    expect(draftsResult.success).toBe(true);
    if (draftsResult.success) {
      expect(draftsResult.value.length).toBe(1);
      expect(draftsResult.value[0].answerId).toBe(answer.id);
    }
  });

  it('should allow multiple drafts for multiple-choice questions', async () => {
    // Create multiple-choice question
    const mcQuestionResult = Question.create(
      poll.id,
      'Multiple Choice Question',
      'multiple-choice',
      2
    );
    expect(mcQuestionResult.success).toBe(true);
    if (mcQuestionResult.success) {
      const mcQuestion = mcQuestionResult.value;
      await pollRepository.createQuestion(mcQuestion);

      const answer1Result = Answer.create(mcQuestion.id, 'Answer 1', 1);
      const answer2Result = Answer.create(mcQuestion.id, 'Answer 2', 2);
      expect(answer1Result.success && answer2Result.success).toBe(true);
      if (answer1Result.success && answer2Result.success) {
        const answer1 = answer1Result.value;
        const answer2 = answer2Result.value;
        await pollRepository.createAnswer(answer1);
        await pollRepository.createAnswer(answer2);

        // Submit first draft
        await useCase.execute({
          userId: 'user-1',
          pollId: poll.id,
          questionId: mcQuestion.id,
          answerId: answer1.id,
          isSingleChoice: false,
        });

        // Submit second draft
        const result = await useCase.execute({
          userId: 'user-1',
          pollId: poll.id,
          questionId: mcQuestion.id,
          answerId: answer2.id,
          isSingleChoice: false,
        });

        expect(result.success).toBe(true);

        // Verify both drafts exist
        const draftsResult = await pollRepository.getUserDrafts(
          'user-1',
          poll.id
        );
        expect(draftsResult.success).toBe(true);
        if (draftsResult.success) {
          const mcDrafts = draftsResult.value.filter(
            (d) => d.questionId === mcQuestion.id
          );
          expect(mcDrafts.length).toBe(2);
        }
      }
    }
  });

  it('BUG: should allow unselecting (removing) a draft for multiple-choice questions', async () => {
    // Create multiple-choice question
    const mcQuestionResult = Question.create(
      poll.id,
      'Multiple Choice Question',
      'multiple-choice',
      2
    );
    expect(mcQuestionResult.success).toBe(true);
    if (mcQuestionResult.success) {
      const mcQuestion = mcQuestionResult.value;
      await pollRepository.createQuestion(mcQuestion);

      const answer1Result = Answer.create(mcQuestion.id, 'Answer 1', 1);
      const answer2Result = Answer.create(mcQuestion.id, 'Answer 2', 2);
      expect(answer1Result.success && answer2Result.success).toBe(true);
      if (answer1Result.success && answer2Result.success) {
        const answer1 = answer1Result.value;
        const answer2 = answer2Result.value;
        await pollRepository.createAnswer(answer1);
        await pollRepository.createAnswer(answer2);

        // Submit first draft (select answer1)
        const result1 = await useCase.execute({
          userId: 'user-1',
          pollId: poll.id,
          questionId: mcQuestion.id,
          answerId: answer1.id,
          isSingleChoice: false,
        });
        expect(result1.success).toBe(true);

        // Submit second draft (select answer2)
        const result2 = await useCase.execute({
          userId: 'user-1',
          pollId: poll.id,
          questionId: mcQuestion.id,
          answerId: answer2.id,
          isSingleChoice: false,
        });
        expect(result2.success).toBe(true);

        // Verify both drafts exist
        let draftsResult = await pollRepository.getUserDrafts(
          'user-1',
          poll.id
        );
        expect(draftsResult.success).toBe(true);
        if (draftsResult.success) {
          const mcDrafts = draftsResult.value.filter(
            (d) => d.questionId === mcQuestion.id
          );
          expect(mcDrafts.length).toBe(2);
        }

        // NOW UNSELECT answer1 by submitting it again (toggle off)
        // This should remove the draft for answer1
        const result3 = await useCase.execute({
          userId: 'user-1',
          pollId: poll.id,
          questionId: mcQuestion.id,
          answerId: answer1.id,
          isSingleChoice: false,
          shouldRemove: true, // Add flag to indicate unselection
        });
        expect(result3.success).toBe(true);

        // Verify only answer2 draft remains
        draftsResult = await pollRepository.getUserDrafts('user-1', poll.id);
        expect(draftsResult.success).toBe(true);
        if (draftsResult.success) {
          const mcDrafts = draftsResult.value.filter(
            (d) => d.questionId === mcQuestion.id
          );
          expect(mcDrafts.length).toBe(1);
          expect(mcDrafts[0].answerId).toBe(answer2.id);
        }
      }
    }
  });
});
