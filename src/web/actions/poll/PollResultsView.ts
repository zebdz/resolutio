/** Browser results retain validated references, tally units and signing-consent alternatives.
 * Explicit mapping strips aggregates, viewer facts and unauthorized voter/contact fields. */
import type { QuestionType } from '@/domain/poll/QuestionType';
import type { GetPollResultsResult } from '@/application/poll/GetPollResultsUseCase';
import type {
  PollId,
  QuestionId,
  AnswerId,
  UserId,
} from '@/domain/shared/EntityIds';
import type { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import type { VotingWeight } from '@/domain/poll/VotingWeight';
import {
  ParticipantCount,
  sumVotingWeights,
} from '@/domain/poll/ResultTallies';
import type {
  VoteCount,
  TotalVotingWeight,
  VotingPercentage,
} from '@/domain/poll/ResultTallies';
import { User } from '@/domain/user/User';

export interface AnswerResult {
  answerId: AnswerId;
  answerText: AnswerText;
  voteCount: VoteCount;
  weightedVotes: TotalVotingWeight;
  percentage: VotingPercentage;
  voters: {
    userId: UserId;
    userName: string;
    weight: VotingWeight;
  }[];
}

interface QuestionResult {
  questionId: QuestionId;
  questionText: QuestionText;
  questionType: QuestionType;
  totalVotes: VoteCount;
  totalWeight: TotalVotingWeight;
  participantWeight: TotalVotingWeight;
  answers: AnswerResult[];
}

type ProtocolSignWillingnessEntry = {
  userId: UserId;
  firstName: string;
  lastName: string;
  middleName: string | null;
  // Server sends this only for admins, and only for willing participants.
} & (
  | { willingToSignProtocol: true; phoneNumber: string | null }
  | { willingToSignProtocol: false; phoneNumber: null }
);

export interface PollResultsData {
  pollId: PollId;
  totalParticipants: ParticipantCount;
  totalWeight: TotalVotingWeight;
  votedParticipants: ParticipantCount;
  questions: QuestionResult[];
  protocolSignWillingness: ProtocolSignWillingnessEntry[];
}

export interface PollResultsView {
  results: PollResultsData;
  canViewVoterNames: boolean;
  canViewSignWillingness: boolean;
}

export function serializePollResults(
  source: GetPollResultsResult
): PollResultsView {
  const canViewVoters = source.canViewVoterNames;
  const canViewSignWillingness = source.canViewSignWillingness;

  return {
    canViewVoterNames: canViewVoters,
    canViewSignWillingness,
    results: {
      pollId: source.poll.id,
      totalParticipants: source.totalParticipants,
      totalWeight: source.totalParticipantWeight,
      // Count before filtering identities; multi-choice selections count a voter once.
      votedParticipants: ParticipantCount.parse(
        source.results.reduce((count, question) => {
          const uniqueVoters = new Set(
            question.answers.flatMap((answer) =>
              answer.voters.map((voter) => voter.userId)
            )
          );

          return Math.max(count, uniqueVoters.size);
        }, 0)
      ),
      questions: source.results.map((question) => ({
        questionId: question.questionId,
        questionText: question.questionText,
        questionType: question.questionType,
        totalVotes: question.totalVotes,
        // Σ answer weights double-counts multi-choice voters; each tick is a separate row.
        totalWeight: sumVotingWeights(
          question.answers.map((answer) => answer.totalWeight)
        ),
        // Σ unique voters' weights is the denominator for "% of building".
        participantWeight: question.participantWeight,
        answers: question.answers.map((answer) => ({
          answerId: answer.answerId,
          answerText: answer.answerText,
          voteCount: answer.voteCount,
          weightedVotes: answer.totalWeight,
          percentage: answer.percentage,
          // SECURITY: Filter before returning from the action, even for direct callers.
          voters: canViewVoters
            ? answer.voters.map((voter) => ({
                userId: voter.userId,
                userName: User.formatFullName(
                  voter.userName.firstName,
                  voter.userName.lastName,
                  voter.userName.middleName
                ),
                weight: voter.weight,
              }))
            : [],
        })),
      })),
      // Signing consent is a separate admin-only gate, independent of voter names.
      protocolSignWillingness: canViewSignWillingness
        ? source.protocolSignWillingness.map((entry) => ({
            userId: entry.userId,
            firstName: entry.firstName,
            lastName: entry.lastName,
            middleName: entry.middleName,
            ...(entry.willingToSignProtocol
              ? {
                  willingToSignProtocol: true as const,
                  phoneNumber: entry.phoneNumber?.getValue() ?? null,
                }
              : { willingToSignProtocol: false as const, phoneNumber: null }),
          }))
        : [],
    },
  };
}
