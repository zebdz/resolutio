import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetUserVotingProgressUseCase } from '../GetUserVotingProgressUseCase';
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
import { Answer } from '../../../domain/poll/Answer';
import { Decimal } from 'decimal.js';

describe('GetUserVotingProgressUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let draftRepository: Partial<DraftRepository>;
  let useCase: GetUserVotingProgressUseCase;
  let poll: Poll;
  let question1: Question;
  let question2: Question;
  let answer1: Answer;
  let answer2: Answer;
  let participant: PollParticipant;

  beforeEach(() => {
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
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Create two questions
    const question1Result = Question.create(
      'Question 1',
      poll.id,
      1,
      0,
      'single-choice'
    );
    expect(question1Result.success).toBe(true);
    question1 = question1Result.value;
    (question1 as any).props.id = 'question-1';

    const question2Result = Question.create(
      'Question 2',
      poll.id,
      1,
      1,
      'single-choice'
    );
    expect(question2Result.success).toBe(true);
    question2 = question2Result.value;
    (question2 as any).props.id = 'question-2';

    // Create answers
    const answer1Result = Answer.create('Answer 1', 1, question1.id);
    expect(answer1Result.success).toBe(true);
    answer1 = answer1Result.value;
    (answer1 as any).props.id = 'answer-1';

    const answer2Result = Answer.create('Answer 2', 1, question2.id);
    expect(answer2Result.success).toBe(true);
    answer2 = answer2Result.value;
    (answer2 as any).props.id = 'answer-2';

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
      questions: [question1, question2],
    });

    // Create a participant
    const participantResult = PollParticipant.create(
      poll.id,
      'user-1',
      new Decimal(1.0).toNumber()
    );
    expect(participantResult.success).toBe(true);
    participant = participantResult.value;
    (participant as any).props.id = 'participant-1';

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipantByUserAndPoll: vi
        .fn()
        .mockResolvedValue(success(participant)),
    };

    voteRepository = {
      hasUserFinishedVoting: vi.fn().mockResolvedValue(success(false)),
    };

    draftRepository = {
      getUserDrafts: vi.fn().mockResolvedValue(success([])),
    };

    useCase = new GetUserVotingProgressUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      draftRepository as DraftRepository
    );
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
    // Create draft
    const draftResult = VoteDraft.create(
      poll.id,
      question1.id,
      answer1.id,
      'user-1'
    );
    expect(draftResult.success).toBe(true);
    draftRepository.getUserDrafts = vi
      .fn()
      .mockResolvedValue(success([draftResult.value]));

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
    voteRepository.hasUserFinishedVoting = vi
      .fn()
      .mockResolvedValue(success(true));

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
    // Create inactive poll
    const inactivePoll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      boardId: poll.boardId,
      startDate: poll.startDate,
      endDate: poll.endDate,
      active: false,
      finished: poll.finished,
      participantsSnapshotTaken: poll.participantsSnapshotTaken,
      weightCriteria: poll.weightCriteria,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: [question1, question2],
    });
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(inactivePoll));

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
    // Create finished poll
    const finishedPoll = Poll.reconstitute({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      boardId: poll.boardId,
      startDate: poll.startDate,
      endDate: poll.endDate,
      active: false,
      finished: true,
      participantsSnapshotTaken: poll.participantsSnapshotTaken,
      weightCriteria: poll.weightCriteria,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      archivedAt: poll.archivedAt,
      questions: [question1, question2],
    });
    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(finishedPoll));

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
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));

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
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

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
    // Create two drafts for same question
    const draft1Result = VoteDraft.create(
      poll.id,
      question1.id,
      'answer-1',
      'user-1'
    );
    const draft2Result = VoteDraft.create(
      poll.id,
      question1.id,
      'answer-2',
      'user-1'
    );
    expect(draft1Result.success && draft2Result.success).toBe(true);
    draftRepository.getUserDrafts = vi
      .fn()
      .mockResolvedValue(success([draft1Result.value, draft2Result.value]));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const progress = result.value;
      // Should count question only once even with multiple drafts
      expect(
        progress.answeredQuestionIds.filter((id) => id === question1.id).length
      ).toBe(1);
      expect(progress.drafts.length).toBe(2);
    }
  });
});
