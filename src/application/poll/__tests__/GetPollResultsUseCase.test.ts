import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPollResultsUseCase } from '../GetPollResultsUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Board } from '../../../domain/board/Board';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { Decimal } from 'decimal.js';
import { User } from '@/generated/prisma';

describe('GetPollResultsUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let boardRepository: Partial<BoardRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: GetPollResultsUseCase;
  let poll: Poll;
  let board: Board;
  let question: Question;
  let answer1: Answer;
  let answer2: Answer;
  let participant1: PollParticipant;
  let participant2: PollParticipant;
  let vote1: Vote;
  let vote2: Vote;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'board-1',
      'user-1',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    poll.activate();
    poll.finish();

    // Create board
    const boardResult = Board.create('org-1', 'Test Board', 'user-admin');
    expect(boardResult.success).toBe(true);
    board = boardResult.value;
    (board as any).props.id = 'board-1';

    // Create question
    const questionResult = Question.create(
      'Test Question',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    question = questionResult.value;
    (question as any).props.id = 'question-1';
    (poll as any).props.questions = [question];

    // Create answers
    const answer1Result = Answer.create('Answer 1', 1, 'question-1');
    expect(answer1Result.success).toBe(true);
    answer1 = answer1Result.value;
    (answer1 as any).props.id = 'answer-1';

    const answer2Result = Answer.create('Answer 2', 2, 'question-1');
    expect(answer2Result.success).toBe(true);
    answer2 = answer2Result.value;
    (answer2 as any).props.id = 'answer-2';
    (question as any).props.answers = [answer1, answer2];

    // Create participants
    const participant1Result = PollParticipant.create(
      'poll-1',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(participant1Result.success).toBe(true);
    participant1 = participant1Result.value;
    (participant1 as any).props.id = 'participant-1';

    const participant2Result = PollParticipant.create(
      'poll-1',
      'user-2',
      new Decimal(3.0).toNumber()
    );
    expect(participant2Result.success).toBe(true);
    participant2 = participant2Result.value;
    (participant2 as any).props.id = 'participant-2';

    // Create votes
    const vote1Result = Vote.create(
      'question-1',
      'answer-1',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(vote1Result.success).toBe(true);
    vote1 = vote1Result.value;

    const vote2Result = Vote.create(
      'question-1',
      'answer-2',
      'user-2',
      new Decimal(3.0).toNumber()
    );
    expect(vote2Result.success).toBe(true);
    vote2 = vote2Result.value;

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipants: vi
        .fn()
        .mockResolvedValue(success([participant1, participant2])),
    };

    voteRepository = {
      getVotesByPoll: vi.fn().mockResolvedValue(success([vote1, vote2])),
    };

    boardRepository = {
      findById: vi.fn().mockResolvedValue(board),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      isUserMember: vi.fn().mockResolvedValue(true),
    };

    userRepository = {
      findByIds: vi.fn().mockResolvedValue([
        { id: 'user-1', firstName: 'Alice', lastName: 'Smith' } as User,
        { id: 'user-2', firstName: 'Bob', lastName: 'Johnson' } as User,
      ]),
    };

    useCase = new GetPollResultsUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      boardRepository as BoardRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository
    );
  });

  it('should calculate weighted vote results correctly', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const questionResult = result.value.results[0];
      const answer1Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-1'
      );
      const answer2Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-2'
      );

      expect(answer1Result?.totalWeight).toBe(2.0);
      expect(answer2Result?.totalWeight).toBe(3.0);
      expect(answer1Result?.percentage).toBe(40); // 2 / 5 * 100
      expect(answer2Result?.percentage).toBe(60); // 3 / 5 * 100
    }
  });

  it('should include voter breakdown for admins', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.canViewVoters).toBe(true);
      const answer1Result = result.value.results[0].answers.find(
        (a) => a.answerId === 'answer-1'
      );
      expect(answer1Result?.voters.length).toBe(1);
      expect(answer1Result?.voters[0].userId).toBe('user-1');
      expect(answer1Result?.voters[0].weight).toBe(2.0);
    }
  });

  it('should allow admin to view results of active poll', async () => {
    // Make poll active but not finished
    (poll as any).props.finished = false;

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
  });

  it('should reject non-admin viewing results of active poll', async () => {
    // Make poll active but not finished
    (poll as any).props.active = true;
    (poll as any).props.finished = false;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('poll.errors.resultsAdminOnly');
    }
  });

  it('should allow organization members to view results of finished poll', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(true);
  });

  it('SECURITY: should NOT allow non-creators to view voter breakdown', async () => {
    // Non-admin, non-creator user
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-2',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // canViewVoters should be false for non-creators
      expect(result.value.canViewVoters).toBe(false);
    }
  });

  it('SECURITY: should NOT allow poll creator to view voter breakdown', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1', // This is the creator
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // canViewVoters should be false for the poll creator
      expect(result.value.canViewVoters).toBe(false);
    }
  });

  it('SECURITY: should allow admins to view voter breakdown', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(true);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      // canViewVoters should be true for admins
      expect(result.value.canViewVoters).toBe(true);
    }
  });

  it('should reject non-members viewing results of finished poll', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-outsider',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('poll.errors.notOrganizationMember');
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'user-admin',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should reject when board not found', async () => {
    boardRepository.findById = vi.fn().mockResolvedValue(null);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(PollErrors.BOARD_NOT_FOUND);
    }
  });

  it('should handle zero weight correctly', async () => {
    // Create participant with zero weight
    const participant3Result = PollParticipant.create(
      'poll-1',
      'user-3',
      new Decimal(0).toNumber()
    );
    expect(participant3Result.success).toBe(true);
    const participant3 = participant3Result.value;
    (participant3 as any).props.id = 'participant-3';

    participantRepository.getParticipants = vi
      .fn()
      .mockResolvedValue(success([participant1, participant2, participant3]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.totalParticipants).toBe(3);
      expect(result.value.totalParticipantWeight).toBe(5.0);
    }
  });

  it('should handle poll with no votes', async () => {
    voteRepository.getVotesByPoll = vi.fn().mockResolvedValue(success([]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.totalVotes).toBe(0);
      questionResult.answers.forEach((answer) => {
        expect(answer.voteCount).toBe(0);
        expect(answer.totalWeight).toBe(0);
        expect(answer.percentage).toBe(0);
      });
    }
  });

  it('should exclude archived questions from results', async () => {
    // Add archived question
    const archivedQuestionResult = Question.create(
      'Archived Question',
      'poll-1',
      2,
      0,
      'single-choice'
    );
    expect(archivedQuestionResult.success).toBe(true);
    const archivedQuestion = archivedQuestionResult.value;
    (archivedQuestion as any).props.id = 'question-2';
    archivedQuestion.archive();
    (poll as any).props.questions = [question, archivedQuestion];

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.results.length).toBe(1);
      expect(result.value.results[0].questionId).toBe('question-1');
    }
  });

  it('should exclude archived answers from results', async () => {
    // Archive answer2
    answer2.archive();

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.answers.length).toBe(1);
      expect(questionResult.answers[0].answerId).toBe('answer-1');
    }
  });

  it('should handle multiple-choice questions', async () => {
    // Add another vote for the same user but different answer in multiple-choice scenario
    const vote3Result = Vote.create(
      'question-1',
      'answer-2',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(vote3Result.success).toBe(true);
    const vote3 = vote3Result.value;
    voteRepository.getVotesByPoll = vi
      .fn()
      .mockResolvedValue(success([vote1, vote2, vote3]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.totalVotes).toBe(3);
      const answer1Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-1'
      );
      const answer2Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-2'
      );
      expect(answer1Result?.voteCount).toBe(1);
      expect(answer2Result?.voteCount).toBe(2);
      expect(answer2Result?.totalWeight).toBe(5.0); // 3.0 + 2.0
    }
  });
});
