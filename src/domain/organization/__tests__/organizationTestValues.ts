/** Organization client fixtures supply deterministic creation values. Deliberate
 * text casts let negative tests exercise domain validation of malformed callers. */
import { Organization } from '../Organization';
import {
  NewOrganizationName,
  OrganizationDescription,
} from '../OrganizationValues';
import { OrganizationId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import { ProfanityChecker } from '../../shared/profanity/ProfanityChecker';
export const organizationTestInstant = Instant.parse(
  '2026-01-01T00:00:00.000Z'
);

export function createOrganization(
  name: string,
  description: string,
  createdById: string,
  parentId: string | null = null,
  allowMultiTreeMembership?: boolean,
  checker?: ProfanityChecker
) {
  return Organization.create(
    name as NewOrganizationName,
    description as OrganizationDescription,
    UserId.parse(createdById),
    parentId === null
      ? {
          kind: 'root',
          allowMultiTreeMembership: allowMultiTreeMembership ?? false,
        }
      : { kind: 'child', parentId: OrganizationId.parse(parentId) },
    { id: OrganizationId.parse('org-fixture'), now: organizationTestInstant },
    checker
  );
}

let organizationSequence = 0;
export const organizationCreationInputs = {
  ids: {
    generate: <Id extends string>(schema: { parse(value: unknown): Id }): Id =>
      schema.parse(`created-org-${++organizationSequence}`),
  },
  clock: { now: () => organizationTestInstant },
};
