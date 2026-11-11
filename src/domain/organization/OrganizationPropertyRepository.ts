/** Typed property persistence port; adapters validate raw rows and preserve domain
 * identities and property counts across core queries. */
import { PropertyCount } from './PropertyValues';
import { OrganizationId, PropertyId } from '../shared/EntityIds';
import { Result } from '../shared/Result';
import { OrganizationName } from './OrganizationValues';
import { OrganizationProperty } from './OrganizationProperty';
export type PropertyRepositoryError = 'common.errors.unexpected';

export interface PropertiesByOrg {
  orgId: OrganizationId;
  orgName: OrganizationName;
  properties: OrganizationProperty[];
}

export interface OrganizationPropertyRepository {
  findByOrganization(
    organizationId: OrganizationId
  ): Promise<Result<OrganizationProperty[], PropertyRepositoryError>>;
  findAllByOrganizationIncludingArchived(
    organizationId: OrganizationId
  ): Promise<Result<OrganizationProperty[], PropertyRepositoryError>>;

  // For cross-tree poll scope: properties in rootOrgId + descendants, grouped
  // by org so the UI can render "Direct org" vs "Sub-organizations" sections.
  // First element is ALWAYS the root org (even if it has no properties, it's
  // included as an empty group to simplify UI logic).
  findByOrganizationTree(
    rootOrgId: OrganizationId
  ): Promise<Result<PropertiesByOrg[], PropertyRepositoryError>>;

  findById(
    id: PropertyId
  ): Promise<Result<OrganizationProperty | null, PropertyRepositoryError>>;
  countNonArchived(
    organizationId: OrganizationId
  ): Promise<Result<PropertyCount, PropertyRepositoryError>>;
  hasAnyNonArchived(
    organizationIds: OrganizationId[]
  ): Promise<Result<Map<OrganizationId, boolean>, PropertyRepositoryError>>;

  save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, PropertyRepositoryError>>;
  update(
    property: OrganizationProperty
  ): Promise<Result<void, PropertyRepositoryError>>;
}
