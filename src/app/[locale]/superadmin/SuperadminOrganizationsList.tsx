'use client';

import {
  OrganizationsList,
  type OrganizationItem,
} from '../organizations/OrganizationsList';
import { SuperadminOrgActions } from '@/web/components/superadmin/SuperadminOrgActions';
import { searchAllOrganizationsAction } from '@/web/actions/organization';

interface SuperadminOrganizationsListProps {
  initialOrganizations: OrganizationItem[];
  initialTotalCount: number;
  userId: string;
}

export function SuperadminOrganizationsList({
  initialOrganizations,
  initialTotalCount,
  userId,
}: SuperadminOrganizationsListProps) {
  return (
    <OrganizationsList
      initialOrganizations={initialOrganizations}
      initialTotalCount={initialTotalCount}
      userId={userId}
      searchAction={searchAllOrganizationsAction}
      showArchivedBadge
      renderActions={(org: OrganizationItem, onActionComplete: () => void) => (
        <SuperadminOrgActions
          organizationId={org.id}
          organizationName={org.name}
          isArchived={!!org.archivedAt}
          onActionComplete={onActionComplete}
        />
      )}
    />
  );
}
