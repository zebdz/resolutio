import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { Vote } from '../../domain/poll/Vote';
import { PollParticipant } from '../../domain/poll/PollParticipant';
import { PollRepository } from '../../domain/poll/PollRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollErrors } from './PollErrors';
import { UserRepository } from '@/src/domain/user/UserRepository';

export interface GetPollResultsInput {
  pollId: string;
  userId: string;
}

export interface AnswerResult {
  answerId: string;
  answerText: string;
  voteCount: number;
  totalWeight: number;
  percentage: number;
  voters: Array<{
    userId: string;
    userName: { firstName: string; lastName: string };
    weight: number;
  }>;
}

export interface QuestionResult {
  questionId: string;
  questionText: string;
  questionDetails: string | null;
  questionType: string;
  answers: AnswerResult[];
  totalVotes: number;
}

export interface GetPollResultsResult {
  poll: Poll;
  results: QuestionResult[];
  totalParticipants: number;
  totalParticipantWeight: number;
  canViewVoters: boolean;
}

export class GetPollResultsUseCase {
  constructor(
    private pollRepository: PollRepository,
    private boardRepository: BoardRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    input: GetPollResultsInput
  ): Promise<Result<GetPollResultsResult, string>> {
    const { pollId, userId } = input;

    // 1. Check if poll exists
    const pollResult = await this.pollRepository.getPollById(pollId);
    if (!pollResult.success) {
      return failure(pollResult.error);
    }

    const poll = pollResult.value;
    if (!poll) {
      return failure(PollErrors.NOT_FOUND);
    }

    // 2. Get board and organization to check permissions
    const board = await this.boardRepository.findById(poll.boardId);
    if (!board) {
      return failure(PollErrors.BOARD_NOT_FOUND);
    }

    // 3. Check authorization
    // If poll is active (not finished), only admins can view results
    // If poll is finished, any organization member can view
    const isAdmin = await this.organizationRepository.isUserAdmin(
      userId,
      board.organizationId
    );

    if (poll.isActive() && !poll.isFinished()) {
      if (!isAdmin) {
        return failure('poll.errors.resultsAdminOnly');
      }
    } else {
      // Poll is finished, check if user is organization member
      const isMember = await this.organizationRepository.isUserMember(
        userId,
        board.organizationId
      );

      if (!isMember) {
        return failure('poll.errors.notOrganizationMember');
      }
    }

    // 4. Get all votes and participants
    const votesResult = await this.pollRepository.getVotesByPoll(pollId);
    if (!votesResult.success) {
      return failure(votesResult.error);
    }

    const votes = votesResult.value;

    const participantsResult =
      await this.pollRepository.getParticipants(pollId);
    if (!participantsResult.success) {
      return failure(participantsResult.error);
    }

    const participants = participantsResult.value;

    // 5. Calculate total participant weight
    const totalParticipantWeight = participants.reduce(
      (sum, p) => sum + p.userWeight,
      0
    );

    // 6. Group votes by question
    const votesByQuestion = new Map<string, Vote[]>();
    for (const vote of votes) {
      if (!votesByQuestion.has(vote.questionId)) {
        votesByQuestion.set(vote.questionId, []);
      }

      votesByQuestion.get(vote.questionId)!.push(vote);
    }

    // 7. Calculate results for each question
    const results: QuestionResult[] = [];

    // 8. Fetch users so that we can show voter names if needed
    const usersInfo = new Map<
      string,
      { firstName: string; lastName: string }
    >();
    const users = await this.userRepository.findByIds(
      participants.map((p) => p.userId)
    );
    if (users) {
      for (const user of users) {
        usersInfo.set(user.id, {
          firstName: user.firstName,
          lastName: user.lastName,
        });
      }
    }

    for (const question of poll.questions) {
      if (question.isArchived()) {
        continue;
      }

      const questionVotes = votesByQuestion.get(question.id) || [];

      // Group votes by answer
      const votesByAnswer = new Map<string, Vote[]>();
      for (const vote of questionVotes) {
        if (!votesByAnswer.has(vote.answerId)) {
          votesByAnswer.set(vote.answerId, []);
        }

        votesByAnswer.get(vote.answerId)!.push(vote);
      }

      const answerResults: AnswerResult[] = [];

      for (const answer of question.answers) {
        if (answer.isArchived()) {
          continue;
        }

        const answerVotes = votesByAnswer.get(answer.id) || [];
        const totalWeight = answerVotes.reduce(
          (sum, v) => sum + v.userWeight,
          0
        );

        const percentage =
          totalParticipantWeight > 0
            ? (totalWeight / totalParticipantWeight) * 100
            : 0;

        answerResults.push({
          answerId: answer.id,
          answerText: answer.text,
          voteCount: answerVotes.length,
          totalWeight,
          percentage,
          voters: answerVotes.map((v) => ({
            userId: v.userId,
            userName: usersInfo.get(v.userId) || {
              firstName: 'Unknown',
              lastName: 'Unknown',
            },
            weight: v.userWeight,
          })),
        });
      }

      results.push({
        questionId: question.id,
        questionText: question.text,
        questionDetails: question.details,
        questionType: question.questionType,
        answers: answerResults,
        totalVotes: questionVotes.length,
      });
    }

    return success({
      poll,
      results,
      totalParticipants: participants.length,
      totalParticipantWeight,
      canViewVoters: isAdmin, // || poll.createdBy === userId,
    });
  }
}
