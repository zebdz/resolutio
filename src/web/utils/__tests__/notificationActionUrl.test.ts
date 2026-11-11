/** Every validated event retains its existing navigation or explicit lack of action.
 * Malformed raw payloads are rejected by the domain before reaching this typed helper. */
import { it, expect } from 'vitest';
import { getNotificationActionUrl } from '../notificationActionUrl';
import {
  NotificationContent,
  type NotificationType,
} from '@/domain/notification/NotificationContent';
import { notificationSamples } from '@/web/actions/notification/__tests__/notificationTestViews';

const routes = {
  join_request_received: [
    '/organizations/org-1/pending-requests',
    'viewPendingRequests',
  ],
  join_request_accepted: ['/organizations/org-1', 'viewOrganization'],
  join_request_rejected: ['/organizations/org-1', 'viewOrganization'],
  join_parent_request_received: [
    '/organizations/parent-1/parent-requests',
    'viewParentRequests',
  ],
  join_parent_request_rejected: ['/organizations/child-1', 'viewOrganization'],
  org_joined_parent: ['/organizations/parent-1', 'viewOrganization'],
  org_archived: ['/organizations/org-1', 'viewOrganization'],
  org_unarchived: ['/organizations/org-1', 'viewOrganization'],
  org_name_changed: ['/organizations/org-1', 'viewOrganization'],
  poll_activated: ['/polls/poll-1/vote', 'voteNow'],
  poll_finished: ['/polls/poll-1/results', 'viewResults'],
  poll_submitted: ['/polls/poll-1', 'reviewPoll'],
  poll_returned_to_draft: ['/polls/poll-1/edit', 'editPoll'],
  auto_join_failed: ['/organizations/org-1', 'viewOrganization'],
  admin_invite_received: ['/invitations', 'respondToInvite'],
  board_member_invite_received: ['/invitations', 'respondToInvite'],
  member_invite_received: ['/invitations', 'respondToInvite'],
  admin_invite_accepted: ['/organizations/org-1/modify', 'viewOrganization'],
  board_member_invite_accepted: [
    '/organizations/org-1/boards/board-1/manage',
    'viewBoard',
  ],
  member_invite_accepted: ['/organizations/org-1', 'viewOrganization'],
  admin_removed: ['/organizations/org-1', 'viewOrganization'],
  board_member_removed: ['/organizations/org-1', 'viewOrganization'],
  member_removed_from_organization: [
    '/organizations/org-1',
    'viewOrganization',
  ],
  invite_declined: ['/organizations/org-1', 'viewOrganization'],
  invite_revoked: ['/organizations/org-1', 'viewOrganization'],
  property_claim_submitted: [
    '/organizations/org-1/property-claims',
    'viewPropertyClaims',
  ],
  property_claim_approved: ['/organizations/org-1', 'viewOrganization'],
  property_claim_denied: ['/organizations/org-1', 'viewOrganization'],
  report_published: ['/reports/report-1', 'viewReport'],
  member_left_board: null,
  member_left_organization: null,
  multi_membership_setting_changed: null,
} satisfies Record<NotificationType, [string, string] | null>;

it.each(notificationSamples)('$type preserves its action', (source) => {
  const route = routes[source.type];
  expect(getNotificationActionUrl(source)).toEqual(
    route ? { href: route[0], actionKey: route[1] } : null
  );
});
it.each([
  { type: 'poll_activated', data: null },
  { type: 'poll_activated', data: { organizationId: 'org-1' } },
  { type: 'unknown_type', data: { organizationId: 'org-1' } },
])('rejects invalid raw content at the domain boundary', (input) => {
  const poll = notificationSamples.find(
    (sample) => sample.type === 'poll_activated'
  );
  expect(NotificationContent.safeParse({ ...poll, ...input }).success).toBe(
    false
  );
});
