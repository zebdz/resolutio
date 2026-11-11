/** Explicit notification transport mapping keeps event kinds correlated with their payloads.
 * Only recipient-visible fields are copied; nested data and mutable Dates are detached. */
import type { NotificationSnapshot } from '@/domain/notification/Notification';
import type { NotificationContent } from '@/domain/notification/NotificationContent';

export type NotificationView = NotificationContent &
  Pick<NotificationSnapshot, 'id' | 'readAt' | 'createdAt'>;

export function serializeNotification(
  source: NotificationSnapshot
): NotificationView {
  const content = serializeContent(source);

  return {
    ...content,
    id: source.id,
    readAt: source.readAt === null ? null : new Date(source.readAt),
    createdAt: new Date(source.createdAt),
  };
}

function serializeContent(source: NotificationContent): NotificationContent {
  switch (source.type) {
    case 'admin_invite_accepted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviteeName: source.data.inviteeName,
        },
      };
    case 'admin_invite_received':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          invitationId: source.data.invitationId,
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviterName: source.data.inviterName,
        },
      };
    case 'admin_removed':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          actorName: source.data.actorName,
        },
      };
    case 'board_member_invite_accepted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          boardId: source.data.boardId,
          organizationName: source.data.organizationName,
          boardName: source.data.boardName,
          inviteeName: source.data.inviteeName,
        },
      };
    case 'board_member_invite_received':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          invitationId: source.data.invitationId,
          organizationId: source.data.organizationId,
          boardId: source.data.boardId,
          organizationName: source.data.organizationName,
          boardName: source.data.boardName,
          inviterName: source.data.inviterName,
        },
      };
    case 'board_member_removed':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          boardId: source.data.boardId,
          boardName: source.data.boardName,
          actorName: source.data.actorName,
        },
      };
    case 'invite_declined':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviteeName: source.data.inviteeName,
          inviteType: source.data.inviteType,
        },
      };
    case 'invite_revoked':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviteType: source.data.inviteType,
        },
      };
    case 'join_parent_request_received':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          childOrgId: source.data.childOrgId,
          parentOrgId: source.data.parentOrgId,
          childOrgName: source.data.childOrgName,
          parentOrgName: source.data.parentOrgName,
        },
      };
    case 'join_parent_request_rejected':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          childOrgId: source.data.childOrgId,
          parentOrgId: source.data.parentOrgId,
          childOrgName: source.data.childOrgName,
          parentOrgName: source.data.parentOrgName,
          rejectionReason: source.data.rejectionReason,
        },
      };
    case 'join_request_accepted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
        },
      };
    case 'join_request_received':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          requesterName: source.data.requesterName,
        },
      };
    case 'join_request_rejected':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          rejectionReason: source.data.rejectionReason,
        },
      };
    case 'member_left_board':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          boardId: source.data.boardId,
          boardName: source.data.boardName,
          memberName: source.data.memberName,
        },
      };
    case 'member_left_organization':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          memberName: source.data.memberName,
        },
      };
    case 'member_removed_from_organization':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
        },
      };
    case 'multi_membership_setting_changed':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          allowed: source.data.allowed,
        },
      };
    case 'org_archived':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
        },
      };
    case 'org_joined_parent':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          childOrgId: source.data.childOrgId,
          parentOrgId: source.data.parentOrgId,
          childOrgName: source.data.childOrgName,
          parentOrgName: source.data.parentOrgName,
        },
      };
    case 'member_invite_accepted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviteeName: source.data.inviteeName,
        },
      };
    case 'member_invite_received':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          invitationId: source.data.invitationId,
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
          inviterName: source.data.inviterName,
        },
      };
    case 'org_name_changed':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          oldName: source.data.oldName,
          newName: source.data.newName,
        },
      };
    case 'org_unarchived':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
        },
      };
    case 'poll_activated':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          pollId: source.data.pollId,
          pollTitle: source.data.pollTitle,
        },
      };
    case 'poll_finished':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          pollId: source.data.pollId,
          pollTitle: source.data.pollTitle,
        },
      };
    case 'poll_returned_to_draft':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          pollId: source.data.pollId,
          pollTitle: source.data.pollTitle,
        },
      };
    case 'poll_submitted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          pollId: source.data.pollId,
          pollTitle: source.data.pollTitle,
        },
      };
    case 'property_claim_approved':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          claimId: source.data.claimId,
          organizationId: source.data.organizationId,
          assetId: source.data.assetId,
        },
      };
    case 'property_claim_denied':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          claimId: source.data.claimId,
          organizationId: source.data.organizationId,
          assetId: source.data.assetId,
          reason: source.data.reason,
        },
      };
    case 'property_claim_submitted':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          claimId: source.data.claimId,
          organizationId: source.data.organizationId,
          assetId: source.data.assetId,
        },
      };
    case 'report_published':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          reportId: source.data.reportId,
          organizationId: source.data.organizationId,
          title: source.data.title,
        },
      };
    case 'auto_join_failed':
      return {
        type: source.type,
        title: source.title,
        body: source.body,
        data: {
          organizationId: source.data.organizationId,
          organizationName: source.data.organizationName,
        },
      };
  }

  const exhaustive: never = source;

  return exhaustive;
}
