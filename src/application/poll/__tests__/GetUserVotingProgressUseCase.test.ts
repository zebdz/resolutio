import { describe, it, expect, beforeEach } from 'vitest';
import { GetUserVotingProgressUseCase } from '../GetUserVotingProgressUseCase';
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
    if (!poll) {
      return success(null);
    }

    // Populate questions
    const questions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId
    );

    // Reconstitute poll with questions
    const pollWithQuestions = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      boardId: poll.boardId,
      startDate: poll.startDate,
      endDate: poll.endDate,
      active: poll.active,
      finished: poll.finished,
      participantsSnapshotTaken: poll.participantsSnapshotTaken,
      weightCriteria: poll.weightCriteria,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: questions,
    });

    return success(pollWithQuestions);
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
  async createVote(vote: Vote): Promise<Result<void, string>> {
    this.votes.set(`${vote.userId}-${vote.answerId}`, vote);

    return success(undefined);
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
    // Get all questions for this poll
    const pollQuestions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId
    );
    const questionIds = new Set(pollQuestions.map((q) => q.id));

    return success(
      Array.from(this.votes.values()).filter(
        (v) => v.userId === userId && questionIds.has(v.questionId)
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
    // Get all questions for this poll
    const pollQuestions = Array.from(this.questions.values()).filter(
      (q) => q.pollId === pollId
    );
    const questionIds = new Set(pollQuestions.map((q) => q.id));

    const votes = Array.from(this.votes.values()).filter((v) =>
      questionIds.has(v.questionId)
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
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    return success(
      Array.from(this.drafts.values()).filter(
        (d) => d.userId === userId && d.pollId === pollId
      )
    );
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
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
    userId: string,
    questionId: string
  ): Promise<Result<void, string>> {
    const toDelete: string[] = [];
    this.drafts.forEach((draft, key) => {
      if (draft.userId === userId && draft.questionId === questionId) {
        toDelete.push(key);
      }
    });
    toDelete.forEach((key) => this.drafts.delete(key));

    return success(undefined);
  }
}

describe('GetUserVotingProgressUseCase', () => {
  let pollRepository: MockPollRepository;
  let useCase: GetUserVotingProgressUseCase;
  let poll: Poll;
  let question1: Question;
  let question2: Question;
  let answer1: Answer;
  let answer2: Answer;
  let participant: PollParticipant;

  beforeEach(async () => {
    pollRepository = new MockPollRepository();
    useCase = new GetUserVotingProgressUseCase(pollRepository);

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
      await pollRepository.updatePoll(poll);
    }

    // Create two questions
    const question1Result = Question.create(
      'Question 1',
      poll.id,
      1,
      0,
      'single-choice'
    );
    expect(question1Result.success).toBe(true);
    if (question1Result.success) {
      question1 = question1Result.value;
      await pollRepository.createQuestion(question1);
    }

    const question2Result = Question.create(
      'Question 2',
      poll.id,
      1,
      1,
      'single-choice'
    );

    expect(question2Result.success).toBe(true);
    if (question2Result.success) {
      question2 = question2Result.value;
      await pollRepository.createQuestion(question2);
    }

    // Create answers
    const answer1Result = Answer.create(question1.id, 'Answer 1', 1);
    expect(answer1Result.success).toBe(true);
    if (answer1Result.success) {
      answer1 = answer1Result.value;
      await pollRepository.createAnswer(answer1);
    }

    const answer2Result = Answer.create(question2.id, 'Answer 2', 1);
    expect(answer2Result.success).toBe(true);
    if (answer2Result.success) {
      answer2 = answer2Result.value;
      await pollRepository.createAnswer(answer2);
    }

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

    const pollQuestionsResult = await pollRepository.getQuestionsByPollId(
      poll.id
    );
    expect(pollQuestionsResult.success).toBe(true);

    // Reconstitute poll with questions
    poll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      boardId: poll.boardId,
      startDate: poll.startDate,
      endDate: poll.endDate,
      active: true,
      finished: poll.finished,
      participantsSnapshotTaken: poll.participantsSnapshotTaken,
      weightCriteria: poll.weightCriteria,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: pollQuestionsResult.value,
    });

    await pollRepository.updatePoll(poll);
  });

  it('should return voting progress with no drafts', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.poll.id).toBe(poll.id);
      expect(progress.drafts.length).toBe(0);
      expect(progress.hasFinished).toBe(false);
      expect(progress.canVote).toBe(true);
      expect(progress.answeredQuestionIds.length).toBe(0);
      expect(progress.totalQuestions).toBe(2);
    }
  });

  it('should return voting progress with drafts', async () => {
    // Create drafts
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    expect(draft1Result.success).toBe(true);
    if (draft1Result.success) {
      await pollRepository.saveDraft(draft1Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.drafts.length).toBe(1);
      expect(progress.answeredQuestionIds).toContain(question1.id);
      expect(progress.answeredQuestionIds.length).toBe(1);
      expect(progress.canVote).toBe(true);
    }
  });

  it('should indicate user has finished when votes exist', async () => {
    // Create votes
    const vote1Result = Vote.create(question1.id, answer1.id, 'user-1', 1.0);
    expect(vote1Result.success).toBe(true);
    if (vote1Result.success) {
      await pollRepository.createVote(vote1Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.hasFinished).toBe(true);
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when poll is not active', async () => {
    // Deactivate poll
    poll.deactivate();
    await pollRepository.updatePoll(poll);

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when poll is finished', async () => {
    // Finish poll
    poll.finish();
    await pollRepository.updatePoll(poll);

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should indicate user cannot vote when not a participant', async () => {
    const result = await useCase.execute({
      userId: 'non-participant',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.canVote).toBe(false);
    }
  });

  it('should reject when poll not found', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: 'non-existent',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should exclude archived questions from total count', async () => {
    // Archive first question
    question1.archive();
    await pollRepository.updateQuestion(question1);

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      expect(progress.totalQuestions).toBe(1); // Only non-archived question
    }
  });

  it('should handle multiple drafts for same question', async () => {
    // Create multiple-choice question
    const mcQuestionResult = Question.create(
      poll.id,
      'Multiple Choice Question',
      'multiple-choice',
      3
    );
    expect(mcQuestionResult.success).toBe(true);
    if (mcQuestionResult.success) {
      const mcQuestion = mcQuestionResult.value;
      await pollRepository.createQuestion(mcQuestion);

      const answer1Result = Answer.create(mcQuestion.id, 'MC Answer 1', 1);
      const answer2Result = Answer.create(mcQuestion.id, 'MC Answer 2', 2);
      expect(answer1Result.success && answer2Result.success).toBe(true);
      if (answer1Result.success && answer2Result.success) {
        await pollRepository.createAnswer(answer1Result.value);
        await pollRepository.createAnswer(answer2Result.value);

        // Create drafts for both answers
        const draft1 = VoteDraft.create(
          poll.id,
          mcQuestion.id,
          answer1Result.value.id,
          'user-1'
        );
        const draft2 = VoteDraft.create(
          poll.id,
          mcQuestion.id,
          answer2Result.value.id,
          'user-1'
        );

        if (draft1.success && draft2.success) {
          await pollRepository.saveDraft(draft1.value);
          await pollRepository.saveDraft(draft2.value);

          const result = await useCase.execute({
            userId: 'user-1',
            pollId: poll.id,
          });

          expect(result.success).toBe(true);
          if (result.success) {
            const progress = result.value;
            // Should count question only once even with multiple drafts
            expect(
              progress.answeredQuestionIds.filter((id) => id === mcQuestion.id)
                .length
            ).toBe(1);
            expect(progress.drafts.length).toBe(2);
          }
        }
      }
    }
  });
});
