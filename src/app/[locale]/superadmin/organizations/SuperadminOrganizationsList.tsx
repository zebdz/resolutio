'use client';

import {
  OrganizationsList,
  type OrganizationItem,
} from '../../organizations/OrganizationsList';
import { SuperadminOrgActions } from '@/web/components/superadmin/SuperadminOrgActions';
import { searchAllOrganizationsAction } from '@/src/web/actions/organization/organization';

interface SuperadminOrganizationsListProps {
  initialOrganizations: OrganizationItem[];
  initialTotalCount: number;
  userId: string;
  initialSearch?: string;
}

export function SuperadminOrganizationsList({
  initialOrganizations,
  initialTotalCount,
  userId,
  initialSearch,
}: SuperadminOrganizationsListProps) {
  return (
    <OrganizationsList
      initialOrganizations={initialOrganizations}
      initialTotalCount={initialTotalCount}
      userId={userId}
      initialSearch={initialSearch}
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
