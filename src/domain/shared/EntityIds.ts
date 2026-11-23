/** Identity-only contracts for references between application domain modules.
 * Every entity kind has a distinct validated type; seal-format identities remain separate.
 * Each type owns its regex. Current opaque-token contracts retain CUIDs, UUIDs and
 * legacy ASCII tokens; shared syntax does not make their meanings interchangeable. */
import { z } from 'zod';
import { identifier } from './Identifier';

export const UserId = identifier('ApplicationUserId', /^[A-Za-z0-9_-]{1,256}$/);
export type UserId = z.infer<typeof UserId>;
export const OrganizationId = identifier(
  'ApplicationOrganizationId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type OrganizationId = z.infer<typeof OrganizationId>;
export const BoardId = identifier(
  'ApplicationBoardId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type BoardId = z.infer<typeof BoardId>;
export const PollId = identifier('ApplicationPollId', /^[A-Za-z0-9_-]{1,256}$/);
export type PollId = z.infer<typeof PollId>;
export const QuestionId = identifier(
  'ApplicationQuestionId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type QuestionId = z.infer<typeof QuestionId>;
export const AnswerId = identifier(
  'ApplicationAnswerId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type AnswerId = z.infer<typeof AnswerId>;
export const ParticipantId = identifier(
  'ApplicationParticipantId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type ParticipantId = z.infer<typeof ParticipantId>;
export const VoteId = identifier('ApplicationVoteId', /^[A-Za-z0-9_-]{1,256}$/);
export type VoteId = z.infer<typeof VoteId>;
export const VoteDraftId = identifier(
  'ApplicationVoteDraftId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type VoteDraftId = z.infer<typeof VoteDraftId>;
export const ParticipantWeightHistoryId = identifier(
  'ApplicationParticipantWeightHistoryId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type ParticipantWeightHistoryId = z.infer<
  typeof ParticipantWeightHistoryId
>;
export const PollEligibleMemberId = identifier(
  'ApplicationPollEligibleMemberId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type PollEligibleMemberId = z.infer<typeof PollEligibleMemberId>;
export const PollAttachmentId = identifier(
  'ApplicationPollAttachmentId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type PollAttachmentId = z.infer<typeof PollAttachmentId>;
export const PropertyId = identifier(
  'ApplicationPropertyId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type PropertyId = z.infer<typeof PropertyId>;
export const AssetId = identifier(
  'ApplicationAssetId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type AssetId = z.infer<typeof AssetId>;
export const OwnershipId = identifier(
  'ApplicationOwnershipId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type OwnershipId = z.infer<typeof OwnershipId>;
export const PropertyClaimId = identifier(
  'ApplicationPropertyClaimId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type PropertyClaimId = z.infer<typeof PropertyClaimId>;
export const PropertyClaimAttachmentId = identifier(
  'ApplicationPropertyClaimAttachmentId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type PropertyClaimAttachmentId = z.infer<
  typeof PropertyClaimAttachmentId
>;
export const JoinTokenId = identifier(
  'ApplicationJoinTokenId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type JoinTokenId = z.infer<typeof JoinTokenId>;
export const JoinParentRequestId = identifier(
  'ApplicationJoinParentRequestId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type JoinParentRequestId = z.infer<typeof JoinParentRequestId>;
export const InvitationId = identifier(
  'ApplicationInvitationId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type InvitationId = z.infer<typeof InvitationId>;
export const ReportId = identifier(
  'ApplicationReportId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type ReportId = z.infer<typeof ReportId>;
export const ReportAttachmentId = identifier(
  'ApplicationReportAttachmentId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type ReportAttachmentId = z.infer<typeof ReportAttachmentId>;
export const LegalCheckId = identifier(
  'ApplicationLegalCheckId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type LegalCheckId = z.infer<typeof LegalCheckId>;
export const OtpVerificationId = identifier(
  'ApplicationOtpVerificationId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type OtpVerificationId = z.infer<typeof OtpVerificationId>;
export const NotificationId = identifier(
  'ApplicationNotificationId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type NotificationId = z.infer<typeof NotificationId>;
export const SessionId = identifier(
  'ApplicationSessionId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type SessionId = z.infer<typeof SessionId>;
