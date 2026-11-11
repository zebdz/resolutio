/** Plain directory response contracts retain validated references and units.
 * Dates and nickname strings are intentional transport projections; no aggregate crosses the boundary. */
import type { Organization } from '@/domain/organization/Organization';
import type { OrganizationProperty } from '@/domain/organization/OrganizationProperty';
import type { OrganizationId } from '@/domain/shared/EntityIds';
import type { OrganizationName } from '@/domain/organization/OrganizationValues';
import type { ResultCount } from '@/domain/shared/Pagination';
import type {
  serializeOrganizationSummary,
  serializeUserOrganizations,
  serializeAdminPendingRequest,
  serializeOrganizationPendingRequest,
  serializeDirectoryUserSearch,
} from './serializeDirectory';

export type OrganizationReferenceView = Pick<Organization, 'id' | 'name'>;
export type CreatedOrganizationView = {
  organizationId: OrganizationId;
  autoJoinFailed?: boolean;
};
export type OrganizationListView = {
  organizations: ReturnType<typeof serializeOrganizationSummary>[];
};
export type OrganizationSearchView = OrganizationListView & {
  totalCount: ResultCount;
};
export type AllOrganizationsView = {
  organizations: (ReturnType<typeof serializeOrganizationSummary> & {
    archivedAt: Date | null;
  })[];
  totalCount: ResultCount;
};
export type AdminOrganizationsView = {
  organizations: (Pick<
    Organization,
    'id' | 'name' | 'description' | 'archivedAt'
  > & {
    parentOrg: OrganizationReferenceView | null;
  })[];
};
export type UserOrganizationsView = ReturnType<
  typeof serializeUserOrganizations
>;
export type AdminPendingRequestsView = {
  requests: ReturnType<typeof serializeAdminPendingRequest>[];
  totalCount: ResultCount;
};
export type OrganizationPendingRequestsView = {
  requests: ReturnType<typeof serializeOrganizationPendingRequest>[];
  totalCount: ResultCount;
};
export type UserSearchView = ReturnType<typeof serializeDirectoryUserSearch>[];
export type OrganizationPropertyView = Pick<
  OrganizationProperty,
  'id' | 'name'
>;
export type OrganizationPropertiesTreeView = {
  direct: OrganizationPropertyView[];
  descendantGroups: {
    orgId: OrganizationId;
    orgName: OrganizationName;
    properties: OrganizationPropertyView[];
  }[];
};
