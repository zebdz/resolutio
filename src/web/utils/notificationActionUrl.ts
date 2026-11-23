/** Notification navigation consumes a correlated event/payload and typed action keys.
 * Every supported kind explicitly links somewhere or has no action. */
import type {
  NotificationContent,
  NotificationType,
} from '@/domain/notification/NotificationContent';

export type NotificationActionSource = {
  [Kind in NotificationType]: Pick<
    Extract<NotificationContent, { type: Kind }>,
    'type' | 'data'
  >;
}[NotificationType];
export type NotificationActionKey =
  | 'viewPendingRequests'
  | 'viewOrganization'
  | 'viewParentRequests'
  | 'voteNow'
  | 'viewResults'
  | 'reviewPoll'
  | 'editPoll'
  | 'respondToInvite'
  | 'viewBoard'
  | 'viewPropertyClaims'
  | 'viewReport';
export type NotificationAction = {
  href: string;
  actionKey: NotificationActionKey;
};

export function getNotificationActionUrl(
  source: NotificationActionSource
): NotificationAction | null {
  switch (source.type) {
    case 'join_request_received':
      return {
        href: `/organizations/${source.data.organizationId}/pending-requests`,
        actionKey: 'viewPendingRequests',
      };
    case 'join_parent_request_received':
      return {
        href: `/organizations/${source.data.parentOrgId}/parent-requests`,
        actionKey: 'viewParentRequests',
      };
    case 'join_parent_request_rejected':
      return {
        href: `/organizations/${source.data.childOrgId}`,
        actionKey: 'viewOrganization',
      };
    case 'org_joined_parent':
      return {
        href: `/organizations/${source.data.parentOrgId}`,
        actionKey: 'viewOrganization',
      };
    case 'poll_activated':
      return {
        href: `/polls/${source.data.pollId}/vote`,
        actionKey: 'voteNow',
      };
    case 'poll_finished':
      return {
        href: `/polls/${source.data.pollId}/results`,
        actionKey: 'viewResults',
      };
    // An admin reviewing a submitted poll cannot edit it, so they get the
    // read-only page; the author whose poll came back is going to change
    // something, so they get the editor.
    case 'poll_submitted':
      return { href: `/polls/${source.data.pollId}`, actionKey: 'reviewPoll' };
    case 'poll_returned_to_draft':
      return {
        href: `/polls/${source.data.pollId}/edit`,
        actionKey: 'editPoll',
      };
    case 'admin_invite_received':
    case 'board_member_invite_received':
    case 'member_invite_received':
      return { href: '/invitations', actionKey: 'respondToInvite' };
    case 'admin_invite_accepted':
      return {
        href: `/organizations/${source.data.organizationId}/modify`,
        actionKey: 'viewOrganization',
      };
    case 'board_member_invite_accepted':
      return {
        href: `/organizations/${source.data.organizationId}/boards/${source.data.boardId}/manage`,
        actionKey: 'viewBoard',
      };
    // Admin notification: a member submitted a property claim. Land directly
    // on the queue so approve/deny is one click away.
    case 'property_claim_submitted':
      return {
        href: `/organizations/${source.data.organizationId}/property-claims`,
        actionKey: 'viewPropertyClaims',
      };
    // Claimant notifications. Without propertyId in the payload we can't deep-
    // link to the per-property claim view, so route to the org page where the
    // user can navigate into "Properties" → their claim.
    case 'property_claim_approved':
    case 'property_claim_denied':
    case 'join_request_accepted':
    case 'join_request_rejected':
    case 'org_archived':
    case 'org_unarchived':
    case 'org_name_changed':
    case 'auto_join_failed':
    case 'member_invite_accepted':
    case 'invite_revoked':
    case 'admin_removed':
    case 'board_member_removed':
    case 'member_removed_from_organization':
    case 'invite_declined':
      return {
        href: `/organizations/${source.data.organizationId}`,
        actionKey: 'viewOrganization',
      };
    case 'report_published':
      return {
        href: `/reports/${source.data.reportId}`,
        actionKey: 'viewReport',
      };
    case 'member_left_board':
    case 'member_left_organization':
    case 'multi_membership_setting_changed':
      return null;
  }

  const exhaustive: never = source;

  return exhaustive;
}
