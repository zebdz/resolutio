import { describe, it, expect, beforeEach } from 'vitest';
import { ActivatePollUseCase } from '../ActivatePollUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Board } from '../../../domain/board/Board';
import {
  PollRepository,
  UpdateQuestionOrderData,
} from '../../../domain/poll/PollRepository';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { Vote } from '../../../domain/poll/Vote';
import { VoteDraft } from '../../../domain/poll/VoteDraft';
import { ParticipantWeightHistory } from '../../../domain/poll/ParticipantWeightHistory';
import { User } from '@/src/domain/user/User';

class MockPollRepository implements PollRepository {
  private polls: Map<string, Poll> = new Map();
  public participants: PollParticipant[] = [];
  public historyRecords: ParticipantWeightHistory[] = [];

  async createPoll(poll: Poll): Promise<Result<Poll, string>> {
    this.polls.set(poll.id, poll);

    return success(poll);
  }

  async getPollById(pollId: string): Promise<Result<Poll | null, string>> {
    return success(this.polls.get(pollId) || null);
  }

  async getPollsByBoardId(boardId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async getPollsByUserId(userId: string): Promise<Result<Poll[], string>> {
    return success([]);
  }

  async updatePoll(poll: Poll): Promise<Result<void, string>> {
    this.polls.set(poll.id, poll);

    return success(undefined);
  }

  async deletePoll(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async pollHasVotes(pollId: string): Promise<Result<boolean, string>> {
    return success(false);
  }

  async createQuestion(question: Question): Promise<Result<Question, string>> {
    return success(question);
  }

  async getQuestionById(
    questionId: string
  ): Promise<Result<Question | null, string>> {
    return success(null);
  }

  async getQuestionsByPollId(
    pollId: string
  ): Promise<Result<Question[], string>> {
    return success([]);
  }

  async updateQuestion(question: Question): Promise<Result<void, string>> {
    return success(undefined);
  }

  async updateQuestionOrder(
    updates: UpdateQuestionOrderData[]
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteQuestion(questionId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createAnswer(answer: Answer): Promise<Result<Answer, string>> {
    return success(answer);
  }

  async getAnswerById(
    answerId: string
  ): Promise<Result<Answer | null, string>> {
    return success(null);
  }

  async getAnswersByQuestionId(
    questionId: string
  ): Promise<Result<Answer[], string>> {
    return success([]);
  }

  async updateAnswer(answer: Answer): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAnswer(answerId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createVote(vote: Vote): Promise<Result<Vote, string>> {
    return success(vote);
  }

  async createVotes(votes: Vote[]): Promise<Result<void, string>> {
    return success(undefined);
  }

  async getUserVotes(
    pollId: string,
    userId: string
  ): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async hasUserFinishedVoting(
    pollId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    return success(false);
  }

  async getVotesByPoll(pollId: string): Promise<Result<Vote[], string>> {
    return success([]);
  }

  async createParticipants(
    participants: PollParticipant[]
  ): Promise<Result<void, string>> {
    // Assign IDs and store
    participants.forEach((p, index) => {
      (p as any).props.id = `participant-${index + 1}`;
    });
    this.participants.push(...participants);

    return success(undefined);
  }

  async getParticipants(
    pollId: string
  ): Promise<Result<PollParticipant[], string>> {
    return success(this.participants);
  }

  async getParticipantById(
    participantId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async getParticipantByUserAndPoll(
    pollId: string,
    userId: string
  ): Promise<Result<PollParticipant | null, string>> {
    return success(null);
  }

  async updateParticipantWeight(
    participant: PollParticipant
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteParticipant(
    participantId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async createWeightHistory(
    history: ParticipantWeightHistory
  ): Promise<Result<ParticipantWeightHistory, string>> {
    this.historyRecords.push(history);

    return success(history);
  }

  async getWeightHistory(
    pollId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async getParticipantWeightHistory(
    participantId: string
  ): Promise<Result<ParticipantWeightHistory[], string>> {
    return success([]);
  }

  async saveDraft(draft: VoteDraft): Promise<Result<VoteDraft, string>> {
    return success(draft);
  }

  async getUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<VoteDraft[], string>> {
    return success([]);
  }

  async deleteUserDrafts(
    pollId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteAllPollDrafts(pollId: string): Promise<Result<void, string>> {
    return success(undefined);
  }

  async deleteDraftsByQuestion(
    pollId: string,
    questionId: string,
    userId: string
  ): Promise<Result<void, string>> {
    return success(undefined);
  }
}

class MockBoardRepository implements BoardRepository {
  private boards: Map<string, Board> = new Map();
  private boardMembers: Map<string, { userId: string }[]> = new Map();

  async save(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }

  async findById(id: string): Promise<Board | null> {
    return this.boards.get(id) || null;
  }

  async findByOrganizationId(organizationId: string): Promise<Board[]> {
    return [];
  }

  async findGeneralBoardByOrganizationId(
    organizationId: string
  ): Promise<Board | null> {
    return null;
  }

  async findBoardMembers(boardId: string): Promise<{ userId: string }[]> {
    return this.boardMembers.get(boardId) || [];
  }

  async isUserMember(userId: string, boardId: string): Promise<boolean> {
    return false;
  }

  async addUserToBoard(
    userId: string,
    boardId: string,
    addedBy?: string
  ): Promise<void> {
    const current = this.boardMembers.get(boardId);
    if (current?.some((bm) => bm.userId === userId)) {
      return;
    }

    const updated = current?.slice() || [];

    updated.push({ userId });
    this.boardMembers.set(boardId, updated);
  }

  async removeUserFromBoard(
    userId: string,
    boardId: string,
    removedBy?: string,
    removedReason?: string
  ): Promise<void> {}

  async update(board: Board): Promise<Board> {
    this.boards.set(board.id, board);

    return board;
  }
}

describe('ActivatePollUseCase', () => {
  let pollRepository: MockPollRepository;
  let boardRepository: MockBoardRepository;
  let useCase: ActivatePollUseCase;
  let poll: Poll;
  let board: Board;

  beforeEach(() => {
    pollRepository = new MockPollRepository();
    boardRepository = new MockBoardRepository();

    useCase = new ActivatePollUseCase(pollRepository, boardRepository);

    // Create a test board
    const boardResult = Board.reconstitute({
      id: 'board-1',
      name: 'Test Board',
      organizationId: 'org-1',
      isGeneral: false,
      createdAt: new Date(),
      archivedAt: null,
    });
    board = boardResult;
    boardRepository.save(board);

    boardRepository.addUserToBoard('user-1', 'board-1');
    boardRepository.addUserToBoard('user-2', 'board-1');
    boardRepository.addUserToBoard('user-3', 'board-1');

    // Create a test poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      board.id,
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    // Add a question
    const questionResult = Question.create(
      'Question 1',
      poll.id,
      1,
      1,
      'single-choice'
    );
    const question = questionResult.value;
    (question as any).props.id = 'question-1';
    poll.addQuestion(question);

    pollRepository.createPoll(poll);
  });

  it('should activate poll and create participant snapshot on first activation', async () => {
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // Verify poll is active
    const updatedPollResult = await pollRepository.getPollById(poll.id);
    const updatedPoll = updatedPollResult.value;
    expect(updatedPoll.active).toBe(true);
    expect(updatedPoll.participantsSnapshotTaken).toBe(true);

    // Verify participants were created
    expect(pollRepository.participants.length).toBe(3);
    expect(pollRepository.participants[0].userId).toBe('user-1');
    expect(pollRepository.participants[1].userId).toBe('user-2');
    expect(pollRepository.participants[2].userId).toBe('user-3');

    // All should have weight 1.0
    expect(pollRepository.participants[0].userWeight).toBe(1.0);
    expect(pollRepository.participants[1].userWeight).toBe(1.0);
    expect(pollRepository.participants[2].userWeight).toBe(1.0);

    // Verify weight history was created
    expect(pollRepository.historyRecords.length).toBe(3);
  });

  it('should not recreate participants on second activation', async () => {
    // First activation
    await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    const firstParticipantCount = pollRepository.participants.length;

    // Deactivate
    const updatedPollResult = await pollRepository.getPollById(poll.id);
    const updatedPoll = updatedPollResult.value;
    updatedPoll.deactivate();
    await pollRepository.updatePoll(updatedPoll);

    // Second activation
    await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    // Should not create new participants
    expect(pollRepository.participants.length).toBe(firstParticipantCount);
  });

  it('should fail if poll not found', async () => {
    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if board not found', async () => {
    // Create poll with non-existent board
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'non-existent-board',
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const badPoll = pollResult.value;
    (badPoll as any).props.id = 'poll-2';

    const questionResult = Question.create(
      'Question 1',
      badPoll.id,
      1,
      1,
      'single-choice'
    );
    badPoll.addQuestion(questionResult.value);

    await pollRepository.createPoll(badPoll);

    const result = await useCase.execute({
      pollId: badPoll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.BOARD_NOT_FOUND);
  });

  it('should fail if poll already active', async () => {
    // Activate first
    await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    // Try to activate again
    const result = await useCase.execute({
      pollId: poll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_ALREADY_ACTIVE);
  });

  it('should fail if poll has no questions', async () => {
    // Create poll without questions
    const pollResult = Poll.create(
      'Empty Poll',
      'Test Description',
      board.id,
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const emptyPoll = pollResult.value;
    (emptyPoll as any).props.id = 'poll-2';
    await pollRepository.createPoll(emptyPoll);

    const result = await useCase.execute({
      pollId: emptyPoll.id,
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
  });

  it('should create weight history with correct metadata', async () => {
    const adminId = 'admin-1';

    await useCase.execute({
      pollId: poll.id,
      userId: adminId,
    });

    // Check weight history
    expect(pollRepository.historyRecords.length).toBe(3);

    const history = pollRepository.historyRecords[0];
    expect(history.oldWeight).toBe(0);
    expect(history.newWeight).toBe(1.0);
    expect(history.changedBy).toBe(adminId);
    expect(history.reason).toContain('Initial snapshot');
  });
});
