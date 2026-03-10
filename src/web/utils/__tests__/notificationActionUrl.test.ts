import { getNotificationActionUrl } from '../notificationActionUrl';

describe('getNotificationActionUrl', () => {
  describe('returns correct href and actionKey for each type', () => {
    it('join_request_received → /organizations/{id}/pending-requests', () => {
      const result = getNotificationActionUrl('join_request_received', {
        organizationId: 'org-1',
      });
      expect(result).toEqual({
        href: '/organizations/org-1/pending-requests',
        actionKey: 'viewPendingRequests',
      });
    });

    it('join_request_accepted → /organizations/{id}', () => {
      const result = getNotificationActionUrl('join_request_accepted', {
        organizationId: 'org-2',
      });
      expect(result).toEqual({
        href: '/organizations/org-2',
        actionKey: 'viewOrganization',
      });
    });

    it('join_request_rejected → /organizations/{id}', () => {
      const result = getNotificationActionUrl('join_request_rejected', {
        organizationId: 'org-3',
      });
      expect(result).toEqual({
        href: '/organizations/org-3',
        actionKey: 'viewOrganization',
      });
    });

    it('join_parent_request_received → /organizations/{id}/parent-requests', () => {
      const result = getNotificationActionUrl('join_parent_request_received', {
        parentOrgId: 'parent-1',
      });
      expect(result).toEqual({
        href: '/organizations/parent-1/parent-requests',
        actionKey: 'viewParentRequests',
      });
    });

    it('org_joined_parent → /organizations/{id}', () => {
      const result = getNotificationActionUrl('org_joined_parent', {
        parentOrgId: 'parent-2',
      });
      expect(result).toEqual({
        href: '/organizations/parent-2',
        actionKey: 'viewOrganization',
      });
    });

    it('org_archived → /organizations/{id}', () => {
      const result = getNotificationActionUrl('org_archived', {
        organizationId: 'org-4',
      });
      expect(result).toEqual({
        href: '/organizations/org-4',
        actionKey: 'viewOrganization',
      });
    });

    it('org_unarchived → /organizations/{id}', () => {
      const result = getNotificationActionUrl('org_unarchived', {
        organizationId: 'org-5',
      });
      expect(result).toEqual({
        href: '/organizations/org-5',
        actionKey: 'viewOrganization',
      });
    });

    it('poll_activated → /polls/{id}/vote', () => {
      const result = getNotificationActionUrl('poll_activated', {
        pollId: 'poll-1',
      });
      expect(result).toEqual({
        href: '/polls/poll-1/vote',
        actionKey: 'voteNow',
      });
    });

    it('poll_finished → /polls/{id}/results', () => {
      const result = getNotificationActionUrl('poll_finished', {
        pollId: 'poll-2',
      });
      expect(result).toEqual({
        href: '/polls/poll-2/results',
        actionKey: 'viewResults',
      });
    });

    it('auto_join_failed → /organizations/{id}', () => {
      const result = getNotificationActionUrl('auto_join_failed', {
        organizationId: 'org-6',
      });
      expect(result).toEqual({
        href: '/organizations/org-6',
        actionKey: 'viewOrganization',
      });
    });
  });

  describe('returns null for missing/invalid data', () => {
    it('returns null when data is null', () => {
      const result = getNotificationActionUrl('poll_activated', null);
      expect(result).toBeNull();
    });

    it('returns null when required data key is missing', () => {
      const result = getNotificationActionUrl('poll_activated', {
        organizationId: 'org-1',
      });
      expect(result).toBeNull();
    });

    it('returns null for unknown type', () => {
      const result = getNotificationActionUrl('unknown_type', {
        organizationId: 'org-1',
      });
      expect(result).toBeNull();
    });
  });
});
