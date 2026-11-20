/** The validated HTTP projection of one viewer's results. Both status and
 * contents come from the same selected source. Only a sealed source has a digest. */
import { z } from 'zod';
import { PollState } from '@/domain/poll/PollState';
import { DistributionType } from '@/domain/poll/DistributionType';
import { PropertyAggregation } from '@/domain/poll/PropertyAggregation';
import { QUESTION_TYPES } from '@/domain/poll/QuestionType';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import {
  ParticipantCount,
  TotalVotingWeight,
  VoteCount,
  VotingPercentage,
} from '@/domain/poll/ResultTallies';
import {
  AnswerId,
  OrganizationId,
  PollId,
  PollAttachmentId,
  QuestionId,
  ReportId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  BitcoinHeight,
  Digest,
  TotalWeight,
  UtcTimestamp,
} from '@/domain/seal/SealValues';

const name = {
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().nullable(),
};
const signer = z.discriminatedUnion('willingToSignProtocol', [
  z.object({
    ...name,
    userId: UserId,
    willingToSignProtocol: z.literal(true),
    phoneNumber: z.string().nullable(),
  }),
  z.object({
    ...name,
    userId: UserId,
    willingToSignProtocol: z.literal(false),
    phoneNumber: z.null(),
  }),
]);
const answer = z.object({
  answerId: AnswerId,
  answerText: z.string(),
  voteCount: VoteCount,
  weightedVotes: TotalVotingWeight,
  exactWeight: TotalWeight.schema.optional(),
  percentage: VotingPercentage,
  voters: z.array(
    z.object({ userId: UserId, userName: z.string(), weight: VotingWeight })
  ),
});
const question = z.object({
  questionId: QuestionId,
  winningAnswerId: AnswerId.nullable().optional(),
  questionText: z.string(),
  questionType: z.enum(QUESTION_TYPES),
  totalVotes: VoteCount,
  totalWeight: TotalVotingWeight,
  exactTotalWeight: TotalWeight.schema.optional(),
  participantWeight: TotalVotingWeight,
  exactParticipantWeight: TotalWeight.schema.optional(),
  answers: z.array(answer),
});
const seal = z.object({
  rootDigest: Digest.schema,
  status: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('awaitingSubmission') }),
    z.object({ kind: z.enum(['pending', 'simulated']) }),
    z.object({
      kind: z.literal('failed'),
      provider: z.enum(['opentimestamps', 'stub']),
    }),
    z.object({
      kind: z.literal('bitcoin'),
      height: BitcoinHeight.schema,
      time: UtcTimestamp.schema,
    }),
  ]),
});
const coverage = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['preliminary', 'sealing', 'unsealed']) }),
  z.object({ kind: z.literal('sealed'), seal, hasOwnVote: z.boolean() }),
]);
export type ResultsCoverage = z.output<typeof coverage>;

export const resultsPageSchema = z.object({
  title: z.string(),
  description: z.string(),
  attachmentIds: z.array(PollAttachmentId),
  distributionType: z.enum(DistributionType),
  propertyAggregation: z.enum(PropertyAggregation),
  scopedPropertyNames: z.array(z.string()),
  showAggregation: z.boolean(),
  buildingTotal: z.number(),
  pollState: z.enum(PollState),
  isPollCreator: z.boolean(),
  isAnonymous: z.boolean(),
  isOpenPoll: z.boolean(),
  coverage,
  canViewVoterNames: z.boolean(),
  canViewSignWillingness: z.boolean(),
  results: z.object({
    pollId: PollId,
    totalParticipants: ParticipantCount,
    totalWeight: TotalVotingWeight,
    exactTotalWeight: TotalWeight.schema.optional(),
    votedParticipants: ParticipantCount,
    questions: z.array(question),
    protocolSignWillingness: z.array(signer),
  }),
  navigation: z.object({
    firstName: z.string(),
    isSuperAdmin: z.boolean(),
    unreadNotificationCount: z.number().int().nonnegative(),
  }),
  reports: z.array(
    z.object({
      report: z.object({
        id: ReportId,
        title: z.string(),
        body: z.string(),
        state: z.enum(['DRAFT', 'PUBLISHED']),
        visibility: z.string(),
        lastPublishedAt: z.string().nullable(),
        createdAt: z.string(),
        archivedAt: z.string().nullable(),
        organizationId: OrganizationId,
      }),
      author: z.object(name),
    })
  ),
});
export type ResultsPageView = z.output<typeof resultsPageSchema>;
