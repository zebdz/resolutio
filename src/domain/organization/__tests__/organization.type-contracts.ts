/** Compile-only organization clients keep identities, naming policies, hierarchy
 * variants, explicit creation inputs, and pagination units distinct. */
import { Organization } from '../Organization';
import { OrganizationRepository } from '../OrganizationRepository';
import {
  OrganizationDescription,
  OrganizationName,
  NewOrganizationName,
  OrganizationPlacement,
} from '../OrganizationValues';
import { PropertyLockService } from '../PropertyLockService';
import { OrganizationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { PageNumber, PageSize } from '../../shared/Pagination';

declare const repository: OrganizationRepository;
declare const organization: Organization;
const id = OrganizationId.parse('organization');
const actor = UserId.parse('actor');
const name = NewOrganizationName.parse('Organization');
const description = OrganizationDescription.parse('Description');
const placement: OrganizationPlacement = {
  kind: 'root',
  allowMultiTreeMembership: false,
};
const creation = { id, now: Instant.parse('2026-01-01T00:00:00.000Z') };
Organization.create(name, description, actor, placement, creation);
repository.findByName(OrganizationName.parse('Legacy <name>'));
repository.searchOrganizationsWithStats({
  page: PageNumber.parse(1),
  pageSize: PageSize.parse(20),
});

// @ts-expect-error Entity identity/time must be supplied explicitly.
Organization.create(name, description, actor, placement);
// @ts-expect-error Unchecked names cannot enter entity creation.
Organization.create('Organization', description, actor, placement, creation);
// @ts-expect-error Organization identity cannot stand in for the creator.
Organization.create(name, description, id, placement, creation);
// @ts-expect-error Historical names cannot be used as new names without current validation.
organization.updateName(OrganizationName.parse('Legacy <name>'));
const invalidChild: OrganizationPlacement = {
  kind: 'child',
  parentId: id,
  // @ts-expect-error Root-only membership policy cannot be set on a child placement.
  allowMultiTreeMembership: false,
};
const invalidRoot: OrganizationPlacement = {
  kind: 'root',
  allowMultiTreeMembership: false,
  // @ts-expect-error A root cannot carry a parent identity.
  parentId: id,
};
// @ts-expect-error User identity cannot address an organization repository.
repository.findById(actor);
// @ts-expect-error Page size and page number are different units.
repository.searchOrganizationsWithStats({ page: PageSize.parse(20) });
// @ts-expect-error Property locking cannot accept an organization identity.
new PropertyLockService().isLocked(id, []);
void invalidChild;
void invalidRoot;
