import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitDraftUseCase } from '../SubmitDraftUseCase';
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

describe('SubmitDraftUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let draftRepository: Partial<DraftRepository>;
  let useCase: SubmitDraftUseCase;
  let poll: Poll;
  let question: Question;
  let answer: Answer;
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

    // Create a question
    const questionResult = Question.create(
      'Test Question',
      poll.id,
      1,
      0,
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    question = questionResult.value;
    (question as any).props.id = 'question-1';

    // Create an answer and add to question
    const answerResult = Answer.create('Test Answer', 1, question.id);
    expect(answerResult.success).toBe(true);
    answer = answerResult.value;
    (answer as any).props.id = 'answer-1';
    question.addAnswer(answer);

    // Add questions to poll and activate
    (poll as any).props.questions = [question];
    poll.takeSnapshot();
    poll.activate();

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
      saveDraft: vi.fn().mockImplementation((draft) => success(draft)),
      deleteDraftsByQuestion: vi.fn().mockResolvedValue(success(undefined)),
      deleteDraftByAnswer: vi.fn().mockResolvedValue(success(undefined)),
    };

    useCase = new SubmitDraftUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      draftRepository as DraftRepository
    );
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
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      userId: 'user-1',
      pollId: 'non-existent',
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
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
    const inactivePoll = inactivePollResult.value;
    (inactivePoll as any).props.id = 'poll-2';

    pollRepository.getPollById = vi
      .fn()
      .mockResolvedValue(success(inactivePoll));

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
  });

  it('should reject when poll is finished', async () => {
    poll.finish();

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
    participantRepository.getParticipantByUserAndPoll = vi
      .fn()
      .mockResolvedValue(success(null));

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
    voteRepository.hasUserFinishedVoting = vi
      .fn()
      .mockResolvedValue(success(true));

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
  });

  it('should delete existing drafts for single-choice questions', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftsByQuestion).toHaveBeenCalledWith(
      poll.id,
      question.id,
      'user-1'
    );
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should allow multiple drafts for multiple-choice questions', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: false,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftsByQuestion).not.toHaveBeenCalled();
    expect(draftRepository.saveDraft).toHaveBeenCalled();
  });

  it('should allow unselecting (removing) a draft for multiple-choice questions', async () => {
    const result = await useCase.execute({
      userId: 'user-1',
      pollId: poll.id,
      questionId: question.id,
      answerId: answer.id,
      isSingleChoice: false,
      shouldRemove: true,
    });

    expect(result.success).toBe(true);
    expect(draftRepository.deleteDraftByAnswer).toHaveBeenCalledWith(
      poll.id,
      question.id,
      answer.id,
      'user-1'
    );
  });
});
