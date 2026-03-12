type ActionResult = { href: string; actionKey: string } | null;

type TypeConfigEntry =
  | { dataKey: string; url: (id: string) => string; actionKey: string }
  | {
      urlFromData: (data: Record<string, unknown>) => string | null;
      actionKey: string;
    };

const TYPE_CONFIG: Record<string, TypeConfigEntry> = {
  join_request_received: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}/pending-requests`,
    actionKey: 'viewPendingRequests',
  },
  join_request_accepted: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  join_request_rejected: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  join_parent_request_received: {
    dataKey: 'parentOrgId',
    url: (id) => `/organizations/${id}/parent-requests`,
    actionKey: 'viewParentRequests',
  },
  join_parent_request_rejected: {
    dataKey: 'childOrgId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  org_joined_parent: {
    dataKey: 'parentOrgId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  org_archived: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  org_unarchived: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  poll_activated: {
    dataKey: 'pollId',
    url: (id) => `/polls/${id}/vote`,
    actionKey: 'voteNow',
  },
  poll_finished: {
    dataKey: 'pollId',
    url: (id) => `/polls/${id}/results`,
    actionKey: 'viewResults',
  },
  auto_join_failed: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  admin_invite_received: {
    urlFromData: () => '/invitations',
    actionKey: 'respondToInvite',
  },
  board_member_invite_received: {
    urlFromData: () => '/invitations',
    actionKey: 'respondToInvite',
  },
  member_invite_received: {
    urlFromData: () => '/invitations',
    actionKey: 'respondToInvite',
  },
  admin_invite_accepted: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}/modify`,
    actionKey: 'viewOrganization',
  },
  board_member_invite_accepted: {
    urlFromData: (data) => {
      const orgId = data.organizationId;
      const boardId = data.boardId;

      if (typeof orgId !== 'string' || typeof boardId !== 'string') {
        return null;
      }

      return `/organizations/${orgId}/boards/${boardId}/manage`;
    },
    actionKey: 'viewBoard',
  },
  member_invite_accepted: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  invite_revoked: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  admin_removed: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  board_member_removed: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
  invite_declined: {
    dataKey: 'organizationId',
    url: (id) => `/organizations/${id}`,
    actionKey: 'viewOrganization',
  },
};

export function getNotificationActionUrl(
  type: string,
  data: Record<string, unknown> | null
): ActionResult {
  const config = TYPE_CONFIG[type];

  if (!config) {
    return null;
  }

  if (!data) {
    return null;
  }

  if ('urlFromData' in config) {
    const href = config.urlFromData(data);

    if (!href) {
      return null;
    }

    return { href, actionKey: config.actionKey };
  }

  const id = data[config.dataKey];

  if (typeof id !== 'string') {
    return null;
  }

  return { href: config.url(id), actionKey: config.actionKey };
}
