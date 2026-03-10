type ActionResult = { href: string; actionKey: string } | null;

const TYPE_CONFIG: Record<
  string,
  { dataKey: string; url: (id: string) => string; actionKey: string }
> = {
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
};

export function getNotificationActionUrl(
  type: string,
  data: Record<string, unknown> | null
): ActionResult {
  const config = TYPE_CONFIG[type];

  if (!config) {return null;}

  if (!data) {return null;}

  const id = data[config.dataKey];

  if (typeof id !== 'string') {return null;}

  return { href: config.url(id), actionKey: config.actionKey };
}
