import { Result } from '../shared/Result';
import { OrganizationProperty } from './OrganizationProperty';

export interface PropertiesByOrg {
  orgId: string;
  orgName: string;
  properties: OrganizationProperty[];
}

export interface OrganizationPropertyRepository {
  findByOrganization(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>>;
  findAllByOrganizationIncludingArchived(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>>;

  // For cross-tree poll scope: properties in rootOrgId + descendants, grouped
  // by org so the UI can render "Direct org" vs "Sub-organizations" sections.
  // First element is ALWAYS the root org (even if it has no properties, it's
  // included as an empty group to simplify UI logic).
  findByOrganizationTree(
    rootOrgId: string
  ): Promise<Result<PropertiesByOrg[], string>>;

  findById(id: string): Promise<Result<OrganizationProperty | null, string>>;
  countNonArchived(organizationId: string): Promise<Result<number, string>>;
  hasAnyNonArchived(
    organizationIds: string[]
  ): Promise<Result<Map<string, boolean>, string>>;

  save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, string>>;
  update(property: OrganizationProperty): Promise<Result<void, string>>;
}
