import { describe, it, expect, beforeEach } from 'vitest';
import { FinishVotingUseCase } from '../FinishVotingUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { DraftRepository } from '../../../domain/poll/DraftRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { Decimal } from 'decimal.js';

// Mock PollRepository - only implements methods used by FinishVotingUseCase
class MockPollRepository implements Pick<PollRepository, 'getPollById'> {
  private polls: Map<string, Poll> = new Map();
  private questions: Map<string, Question> = new Map();
  private answers: Map<string, Answer> = new Map();
  private nextId = 1;

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

  // Helper methods for test setup
  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    const id = `poll-${this.nextId++}`;
    (poll as any).props.id = id;
    this.polls.set(id, poll);

    return success(poll);
  }

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    const id = `question-${this.nextId++}`;
    (question as any).props.id = id;
    this.questions.set(id, question);

    return success(question);
  }

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    const id = `answer-${this.nextId++}`;
    (answer as any).props.id = id;
    this.answers.set(id, answer);

    return success(answer);
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  getQuestions(): Map<string, Question> {
    return this.questions;
  }
}

// Mock ParticipantRepository - only implements methods used by FinishVotingUseCase
class MockParticipantRepository
  implements Pick<ParticipantRepository, 'getParticipantByUserAndPoll'>
{
  private participants: Map<string, PollParticipant> = new Map();
  private nextId = 1;

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    const participant = Array.from(this.participants.values()).find(
      (p) => p.userId === userId && p.pollId === pollId
    );

    return success(participant || null);
  }

  // Helper method for test setup
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
}

// Mock VoteRepository - only implements methods used by FinishVotingUseCase
class MockVoteRepository
  implements
    Pick<VoteRepository, 'hasUserFinishedVoting' | 'createVotes' | 'pollHasVotes'>
{
  private votes: Map<string, Vote> = new Map();
  private questions: Map<string, Question>;

  constructor(questions: Map<string, Question>) {
    this.questions = questions;
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

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    for (const vote of votes) {
      this.votes.set(`${vote.userId}-${vote.answerId}`, vote);
    }

    return success(undefined);
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

  // Helper methods for test setup and verification
  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    this.votes.set(`${vote.userId}-${vote.answerId}`, vote);

    return success(vote);
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
}

// Mock DraftRepository - only implements methods used by FinishVotingUseCase
class MockDraftRepository
  implements Pick<DraftRepository, 'getUserDrafts' | 'deleteUserDrafts'>
{
  private drafts: Map<string, VoteDraft> = new Map();

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

  // Helper method for test setup
  async saveDraft(draft: VoteDraft): Promise<Result<void, string>> {
    this.drafts.set(`${draft.userId}-${draft.answerId}`, draft);

    return success(undefined);
  }
}

describe('FinishVotingUseCase', () => {
  let pollRepository: MockPollRepository;
  let participantRepository: MockParticipantRepository;
  let voteRepository: MockVoteRepository;
  let draftRepository: MockDraftRepository;
  let useCase: FinishVotingUseCase;
  let poll: Poll;
  let question1: Question;
  let question2: Question;
  let answer1: Answer;
  let answer2: Answer;
  let participant: PollParticipant;

  beforeEach(async () => {
    pollRepository = new MockPollRepository();
    participantRepository = new MockParticipantRepository();
    draftRepository = new MockDraftRepository();

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

    // Create answers and add to questions
    const answer1Result = Answer.create('Answer 1', 1, question1.id);
    expect(answer1Result.success).toBe(true);
    if (answer1Result.success) {
      answer1 = answer1Result.value;
      question1.addAnswer(answer1);
      await pollRepository.createAnswer(answer1);
    }

    const answer2Result = Answer.create('Answer 2', 1, question2.id);
    expect(answer2Result.success).toBe(true);
    if (answer2Result.success) {
      answer2 = answer2Result.value;
      question2.addAnswer(answer2);
      await pollRepository.createAnswer(answer2);
    }

    // Add questions to poll and activate
    const questions = Array.from(pollRepository.getQuestions().values()).filter(
      (q: any) => q.pollId === poll.id
    );
    (poll as any).props.questions = questions;
    poll.activate();
    await pollRepository.updatePoll(poll);

    // Create a participant
    const participantResult = PollParticipant.create(
      poll.id,
      'user-1',
      new Decimal(2.5).toNumber()
    );
    expect(participantResult.success).toBe(true);
    if (participantResult.success) {
      participant = participantResult.value;
      await participantRepository.createParticipants([participant]);
    }

    // Take snapshot
    poll.takeParticipantsSnapshot();
    await pollRepository.updatePoll(poll);

    // Create voteRepository after questions are set up
    voteRepository = new MockVoteRepository(pollRepository.getQuestions());

    // Create use case with all repositories
    useCase = new FinishVotingUseCase(
      pollRepository as unknown as PollRepository,
      participantRepository as unknown as ParticipantRepository,
      voteRepository as unknown as VoteRepository,
      draftRepository as unknown as DraftRepository
    );
  });

  it('should successfully finish voting', async () => {
    // Create drafts for all questions
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    expect(draft1Result.success).toBe(true);
    if (draft1Result.success) {
      await draftRepository.saveDraft(draft1Result.value);
    }

    const draft2Result = VoteDraft.create(
      poll.id,
      question2.id,
      answer2.id,
      'user-1'
    );
    expect(draft2Result.success).toBe(true);
    if (draft2Result.success) {
      await draftRepository.saveDraft(draft2Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    if (!result.success) {
      console.log('Error:', result.error);
    }

    expect(result.success).toBe(true);

    // Verify votes were created
    const votesResult = await voteRepository.getUserVotes(poll.id, 'user-1');
    expect(votesResult.success).toBe(true);
    if (votesResult.success) {
      expect(votesResult.value.length).toBe(2);
      expect(
        votesResult.value.every(
          (v) => v.userWeight === new Decimal(2.5).toNumber()
        )
      ).toBe(true);
    }

    // Verify drafts were deleted
    const draftsResult = await draftRepository.getUserDrafts(poll.id, 'user-1');
    expect(draftsResult.success).toBe(true);
    if (draftsResult.success) {
      expect(draftsResult.value.length).toBe(0);
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
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.NOT_PARTICIPANT);
    }
  });

  it('should reject when user has already voted', async () => {
    // Create a vote
    const voteResult = Vote.create(question1.id, answer1.id, 'user-1', 2.5);
    expect(voteResult.success).toBe(true);
    if (voteResult.success) {
      await voteRepository.createVote(voteResult.value);

      const result = await useCase.execute({
        userId: 'user-1',
        pollId: poll.id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.ALREADY_VOTED);
      }
    }
  });

  it('should reject when not all questions are answered', async () => {
    // Create draft only for first question
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    expect(draft1Result.success).toBe(true);
    if (draft1Result.success) {
      await draftRepository.saveDraft(draft1Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.MUST_ANSWER_ALL_QUESTIONS);
    }
  });

  it('should create votes with participant weight', async () => {
    // Create drafts for all questions
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    const draft2Result = VoteDraft.create(
      poll.id,
      question2.id,
      answer2.id,
      'user-1'
    );
    expect(draft1Result.success && draft2Result.success).toBe(true);
    if (draft1Result.success && draft2Result.success) {
      await draftRepository.saveDraft(draft1Result.value);
      await draftRepository.saveDraft(draft2Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);

    // Verify votes have correct weight
    const votesResult = await voteRepository.getUserVotes(poll.id, 'user-1');
    expect(votesResult.success).toBe(true);
    if (votesResult.success) {
      votesResult.value.forEach((vote) => {
        expect(vote.userWeight === new Decimal(2.5).toNumber()).toBe(true);
      });
    }
  });

  it('should reject when single-choice question has multiple drafts', async () => {
    // Create a second answer for question1 (single-choice)
    const answer1bResult = Answer.create('Answer 1b', 2, question1.id);
    expect(answer1bResult.success).toBe(true);
    const answer1b = answer1bResult.value;
    await pollRepository.createAnswer(answer1b);

    // Create two drafts for single-choice question1
    const draft1aResult = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    const draft1bResult = VoteDraft.create(
      poll.id,
      question1.id,
      answer1b.id,
      'user-1'
    );
    // Draft for question2
    const draft2Result = VoteDraft.create(
      poll.id,
      question2.id,
      answer2.id,
      'user-1'
    );

    expect(
      draft1aResult.success && draft1bResult.success && draft2Result.success
    ).toBe(true);
    if (
      draft1aResult.success &&
      draft1bResult.success &&
      draft2Result.success
    ) {
      await draftRepository.saveDraft(draft1aResult.value);
      await draftRepository.saveDraft(draft1bResult.value);
      await draftRepository.saveDraft(draft2Result.value);
    }

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.SINGLE_CHOICE_MULTIPLE_ANSWERS);
    }
  });
});
