/** Closed notification alternatives bind each event kind to its localization keys
 * and validated payload references. Presentation text snapshots remain plain text. */
import { z } from 'zod';
import {
  OrganizationId,
  BoardId,
  InvitationId,
  PollId,
  ReportId,
  PropertyClaimId,
  AssetId,
} from '../shared/EntityIds';
import { InvitationType } from '../invitation/Invitation';

export const NotificationContent = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('admin_invite_accepted'),
      title: z.literal('notification.types.adminInviteAccepted.title'),
      body: z.literal('notification.types.adminInviteAccepted.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviteeName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('admin_invite_received'),
      title: z.literal('notification.types.adminInviteReceived.title'),
      body: z.literal('notification.types.adminInviteReceived.body'),
      data: z
        .object({
          invitationId: InvitationId,
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviterName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('admin_removed'),
      title: z.literal('notification.types.adminRemoved.title'),
      body: z.literal('notification.types.adminRemoved.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          actorName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('board_member_invite_accepted'),
      title: z.literal('notification.types.boardMemberInviteAccepted.title'),
      body: z.literal('notification.types.boardMemberInviteAccepted.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          boardId: BoardId,
          organizationName: z.string(),
          boardName: z.string(),
          inviteeName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('board_member_invite_received'),
      title: z.literal('notification.types.boardMemberInviteReceived.title'),
      body: z.literal('notification.types.boardMemberInviteReceived.body'),
      data: z
        .object({
          invitationId: InvitationId,
          organizationId: OrganizationId,
          boardId: BoardId,
          organizationName: z.string(),
          boardName: z.string(),
          inviterName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('board_member_removed'),
      title: z.literal('notification.types.boardMemberRemoved.title'),
      body: z.literal('notification.types.boardMemberRemoved.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          boardId: BoardId,
          boardName: z.string(),
          actorName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('invite_declined'),
      title: z.literal('notification.types.inviteDeclined.title'),
      body: z.literal('notification.types.inviteDeclined.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviteeName: z.string(),
          inviteType: InvitationType,
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('invite_revoked'),
      title: z.literal('notification.types.inviteRevoked.title'),
      body: z.literal('notification.types.inviteRevoked.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviteType: InvitationType,
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('join_parent_request_received'),
      title: z.literal('notification.types.joinParentRequestReceived.title'),
      body: z.literal('notification.types.joinParentRequestReceived.body'),
      data: z
        .object({
          childOrgId: OrganizationId,
          parentOrgId: OrganizationId,
          childOrgName: z.string(),
          parentOrgName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('join_parent_request_rejected'),
      title: z.literal('notification.types.joinParentRequestRejected.title'),
      body: z.enum([
        'notification.types.joinParentRequestRejected.body',
        'notification.types.joinParentRequestRejected.bodyWithReason',
      ]),
      data: z
        .object({
          childOrgId: OrganizationId,
          parentOrgId: OrganizationId,
          childOrgName: z.string(),
          parentOrgName: z.string(),
          rejectionReason: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('join_request_accepted'),
      title: z.literal('notification.types.joinRequestAccepted.title'),
      body: z.literal('notification.types.joinRequestAccepted.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('join_request_received'),
      title: z.literal('notification.types.joinRequestReceived.title'),
      body: z.literal('notification.types.joinRequestReceived.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          requesterName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('join_request_rejected'),
      title: z.literal('notification.types.joinRequestRejected.title'),
      body: z.enum([
        'notification.types.joinRequestRejected.body',
        'notification.types.joinRequestRejected.bodyWithReason',
      ]),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          rejectionReason: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('member_left_board'),
      title: z.literal('notification.types.memberLeftBoard.title'),
      body: z.literal('notification.types.memberLeftBoard.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          boardId: BoardId,
          boardName: z.string(),
          memberName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('member_left_organization'),
      title: z.literal('notification.types.memberLeftOrganization.title'),
      body: z.literal('notification.types.memberLeftOrganization.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          memberName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('member_removed_from_organization'),
      title: z.literal(
        'notification.types.memberRemovedFromOrganization.title'
      ),
      body: z.literal('notification.types.memberRemovedFromOrganization.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('multi_membership_setting_changed'),
      title: z.literal(
        'notification.types.multiMembershipSettingChanged.title'
      ),
      body: z.literal('notification.types.multiMembershipSettingChanged.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          allowed: z.boolean(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('org_archived'),
      title: z.literal('notification.types.orgArchived.title'),
      body: z.literal('notification.types.orgArchived.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('org_joined_parent'),
      title: z.literal('notification.types.orgJoinedParent.title'),
      body: z.literal('notification.types.orgJoinedParent.body'),
      data: z
        .object({
          childOrgId: OrganizationId,
          parentOrgId: OrganizationId,
          childOrgName: z.string(),
          parentOrgName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('member_invite_accepted'),
      title: z.literal('notification.types.memberInviteAccepted.title'),
      body: z.literal('notification.types.memberInviteAccepted.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviteeName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('member_invite_received'),
      title: z.literal('notification.types.memberInviteReceived.title'),
      body: z.literal('notification.types.memberInviteReceived.body'),
      data: z
        .object({
          invitationId: InvitationId,
          organizationId: OrganizationId,
          organizationName: z.string(),
          inviterName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('org_name_changed'),
      title: z.literal('notification.types.orgNameChanged.title'),
      body: z.literal('notification.types.orgNameChanged.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          oldName: z.string(),
          newName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('org_unarchived'),
      title: z.literal('notification.types.orgUnarchived.title'),
      body: z.literal('notification.types.orgUnarchived.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('poll_activated'),
      title: z.literal('notification.types.pollActivated.title'),
      body: z.literal('notification.types.pollActivated.body'),
      data: z.object({ pollId: PollId, pollTitle: z.string() }).readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('poll_finished'),
      title: z.literal('notification.types.pollFinished.title'),
      body: z.literal('notification.types.pollFinished.body'),
      data: z.object({ pollId: PollId, pollTitle: z.string() }).readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('poll_returned_to_draft'),
      title: z.literal('notification.types.pollReturnedToDraft.title'),
      body: z.literal('notification.types.pollReturnedToDraft.body'),
      data: z.object({ pollId: PollId, pollTitle: z.string() }).readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('poll_submitted'),
      title: z.literal('notification.types.pollSubmitted.title'),
      body: z.literal('notification.types.pollSubmitted.body'),
      data: z.object({ pollId: PollId, pollTitle: z.string() }).readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('property_claim_approved'),
      title: z.literal('notification.types.propertyClaimApproved.title'),
      body: z.literal('notification.types.propertyClaimApproved.body'),
      data: z
        .object({
          claimId: PropertyClaimId,
          organizationId: OrganizationId,
          assetId: AssetId,
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('property_claim_denied'),
      title: z.literal('notification.types.propertyClaimDenied.title'),
      body: z.literal('notification.types.propertyClaimDenied.body'),
      data: z
        .object({
          claimId: PropertyClaimId,
          organizationId: OrganizationId,
          assetId: AssetId,
          reason: z.string().nullable(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('property_claim_submitted'),
      title: z.literal('notification.types.propertyClaimSubmitted.title'),
      body: z.literal('notification.types.propertyClaimSubmitted.body'),
      data: z
        .object({
          claimId: PropertyClaimId,
          organizationId: OrganizationId,
          assetId: AssetId,
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('report_published'),
      title: z.literal('notification.types.reportPublished.title'),
      body: z.literal('notification.types.reportPublished.body'),
      data: z
        .object({
          reportId: ReportId,
          organizationId: OrganizationId,
          title: z.string(),
        })
        .readonly(),
    })
    .readonly(),
  z
    .object({
      type: z.literal('auto_join_failed'),
      title: z.literal('notification.types.autoJoinFailed.title'),
      body: z.literal('notification.types.autoJoinFailed.body'),
      data: z
        .object({
          organizationId: OrganizationId,
          organizationName: z.string(),
        })
        .readonly(),
    })
    .readonly(),
]);
export type NotificationContent = z.infer<typeof NotificationContent>;
export type NotificationType = NotificationContent['type'];
export const NotificationCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'NotificationCount'>();
export type NotificationCount = z.infer<typeof NotificationCount>;
export const NotificationOffset = z
  .number()
  .int()
  .nonnegative()
  .brand<'NotificationOffset'>();
export type NotificationOffset = z.infer<typeof NotificationOffset>;
