/** Authorized poll results preserve domain IDs and weighted tally units.
 * Viewer facts and signing consent remain server-only authorization inputs. */
import {
  VoteCount,
  ParticipantCount,
  TotalVotingWeight,
  VotingPercentage,
  sumVotingWeights,
  percentageOfWeight,
} from '../../domain/poll/ResultTallies';
import { VotingWeight } from '../../domain/poll/VotingWeight';
import {
  AnswerText,
  QuestionText,
  QuestionDetails,
} from '../../domain/poll/QuestionValues';
import { QuestionType } from '../../domain/poll/QuestionType';
import { PollWriteFailure } from '../../domain/poll/PollWriteFailure';
import { PollError } from './PollErrors';
import { z } from 'zod';
import {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
} from '../../domain/shared/EntityIds';
import { Result, success, failure } from '../../domain/shared/Result';
import { Poll } from '../../domain/poll/Poll';
import { Vote } from '../../domain/poll/Vote';
import { PollRepository } from '../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PollErrors } from './PollErrors';
import { UserRepository } from '@/src/domain/user/UserRepository';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import {
  PollResultsPolicy,
  ResultsViewerFacts,
} from '../../domain/poll/PollResultsPolicy';

export interface GetPollResultsInput {
  pollId: string;
  userId: string;
}

export interface AnswerResult {
  answerId: AnswerId;
  answerText: AnswerText;
  voteCount: VoteCount;
  totalWeight: TotalVotingWeight;
  percentage: VotingPercentage;
  voters: Array<{
    userId: UserId;
    userName: {
      firstName: string;
      lastName: string;
      middleName: string | null;
    };
    weight: VotingWeight;
  }>;
}

export interface QuestionResult {
  questionId: QuestionId;
  questionText: QuestionText;
  questionDetails: QuestionDetails | null;
  questionType: QuestionType;
  answers: AnswerResult[];
  totalVotes: VoteCount;
  // Σ unique voters' weights for this question. Same as Σ answer weights for
  // single-choice; for multi-choice each voter is counted once even when they
  // pick multiple answers. Use this (not Σ answer weights) for "% of building"
  // since voter participation is by definition per person, not per ticked box.
  participantWeight: TotalVotingWeight;
}

interface ProtocolSignerIdentity {
  userId: UserId;
  firstName: string;
  lastName: string;
  middleName: string | null;
}

// Non-null only when willingToSignProtocol is true — the voter consented to
// signing and to sharing their phone as a single combined statement.
export type ProtocolSignWillingnessEntry = ProtocolSignerIdentity &
  (
    | { willingToSignProtocol: true; phoneNumber: PhoneNumber | null }
    | { willingToSignProtocol: false; phoneNumber: null }
  );

export interface GetPollResultsResult {
  poll: Poll;
  results: QuestionResult[];
  totalParticipants: ParticipantCount;
  totalParticipantWeight: TotalVotingWeight;
  canViewVoterNames: boolean;
  // Sign-willingness carries phone numbers gathered under a separate consent,
  // so it is gated apart from the voting record and stays admin-only even when
  // a named poll opens voter names to the whole organization.
  canViewSignWillingness: boolean;
  // SERVER-SIDE ONLY. PDF routes re-ask the policy about export rights with
  // these. Never serialize this to a Client Component.
  viewerFacts: ResultsViewerFacts;
  protocolSignWillingness: ProtocolSignWillingnessEntry[];
}

export class GetPollResultsUseCase {
  constructor(
    private pollRepository: PollRepository,
    private participantRepository: ParticipantRepository,
    private voteRepository: VoteRepository,
    private organizationRepository: OrganizationRepository,
    private userRepository: UserRepository
  ) {}

  async execute(
    rawRequest: GetPollResultsInput
  ): Promise<
    Result<
      GetPollResultsResult,
      PollWriteFailure | PollError | 'common.errors.validationFailed'
    >
  > {
    const decoded = z
      .object({ pollId: PollId, userId: UserId })
      .safeParse(rawRequest);

    if (!decoded.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawRequest, ...decoded.data };

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

    // 2. Assemble the viewer's facts, then let the domain policy decide.
    // The participant lookup used to run only for open polls; a named poll now
    // grants access on the strength of it too, so it is resolved up front.
    const [isSuperAdmin, isOrganizationAdmin, isMember, participantResult] =
      await Promise.all([
        this.userRepository.isSuperAdmin(userId),
        this.organizationRepository.isUserAdmin(userId, poll.organizationId),
        this.organizationRepository.isUserMember(userId, poll.organizationId),
        this.participantRepository.getParticipantByUserAndPoll(pollId, userId),
      ]);

    const viewerFacts: ResultsViewerFacts = {
      isAdmin: isSuperAdmin || isOrganizationAdmin,
      isOrgMember: isMember,
      isPollVoter: participantResult.success && !!participantResult.value,
    };

    const readable = PollResultsPolicy.canViewResults(poll, viewerFacts);

    if (!readable.success) {
      return failure(readable.error);
    }

    const canViewVoterNames = PollResultsPolicy.canViewVoterNames(
      poll,
      viewerFacts
    );
    const canViewSignWillingness =
      PollResultsPolicy.canViewSignWillingness(viewerFacts);

    // 4. Get all votes and participants
    const votesResult = await this.voteRepository.getVotesByPoll(pollId);

    if (!votesResult.success) {
      return failure(votesResult.error);
    }

    const votes = votesResult.value;

    const participantsResult =
      await this.participantRepository.getParticipants(pollId);

    if (!participantsResult.success) {
      return failure(participantsResult.error);
    }

    const participants = participantsResult.value;

    // 5. Calculate total participant weight
    const totalParticipantWeight = sumVotingWeights(
      participants.map((p) => p.userWeight)
    );

    // 6. Group votes by question
    const votesByQuestion = new Map<QuestionId, Vote[]>();

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
      UserId,
      { firstName: string; lastName: string; middleName: string | null }
    >();
    const users = await this.userRepository.findByIds(
      participants.map((p) => p.userId)
    );

    if (users) {
      for (const user of users) {
        usersInfo.set(user.id, {
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName ?? null,
        });
      }
    }

    for (const question of poll.questions) {
      if (question.isArchived()) {
        continue;
      }

      const questionVotes = votesByQuestion.get(question.id) || [];

      // Group votes by answer
      const votesByAnswer = new Map<AnswerId, Vote[]>();

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
        const totalWeight = sumVotingWeights(
          answerVotes.map((v) => v.userWeight)
        );

        const percentage = percentageOfWeight(
          totalWeight,
          totalParticipantWeight
        );

        answerResults.push({
          answerId: answer.id,
          answerText: answer.text,
          voteCount: VoteCount.parse(answerVotes.length),
          totalWeight,
          percentage,
          voters: answerVotes.map((v) => ({
            userId: v.userId,
            userName: usersInfo.get(v.userId) || {
              firstName: 'Unknown',
              lastName: 'Unknown',
              middleName: null,
            },
            weight: v.userWeight,
          })),
        });
      }

      // Dedupe by userId — a multi-choice voter casting N votes contributes
      // their weight only once to the participation total.
      const uniqueVoterWeights = new Map<UserId, VotingWeight>();

      for (const v of questionVotes) {
        if (!uniqueVoterWeights.has(v.userId)) {
          uniqueVoterWeights.set(v.userId, v.userWeight);
        }
      }

      const participantWeight = sumVotingWeights(
        Array.from(uniqueVoterWeights.values())
      );

      results.push({
        questionId: question.id,
        questionText: question.text,
        questionDetails: question.details,
        questionType: question.questionType,
        answers: answerResults,
        totalVotes: VoteCount.parse(questionVotes.length),
        participantWeight,
      });
    }

    // 9. Build protocol sign willingness data (admin only)
    let protocolSignWillingness: ProtocolSignWillingnessEntry[] = [];

    if (canViewSignWillingness) {
      const votedParticipants = participants.filter(
        (p) => p.willingToSignProtocol !== null
      );

      protocolSignWillingness = votedParticipants.map((p) => {
        const user = users?.find((u) => u.id === p.userId);
        const isWilling = p.willingToSignProtocol!;

        return {
          userId: p.userId,
          firstName: user?.firstName ?? 'Unknown',
          lastName: user?.lastName ?? 'Unknown',
          middleName: user?.middleName ?? null,
          // Someone who declined refused the whole combined consent, so their
          // number stays hidden even though we hold it.
          ...(isWilling
            ? {
                willingToSignProtocol: true as const,
                phoneNumber: user?.phoneNumber ?? null,
              }
            : { willingToSignProtocol: false as const, phoneNumber: null }),
        };
      });
    }

    return success({
      poll,
      results,
      totalParticipants: ParticipantCount.parse(participants.length),
      totalParticipantWeight,
      canViewVoterNames,
      canViewSignWillingness,
      viewerFacts,
      protocolSignWillingness,
    });
  }
}
