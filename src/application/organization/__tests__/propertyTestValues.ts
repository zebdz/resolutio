/** Explicit deterministic creation dependencies and validated claim fixtures for
 * property use-case tests; storage doubles never mutate entity internals. */
import { Clock, IdGenerator } from '../../shared/EntityCreation';
import { Instant } from '../../../domain/shared/Instant';
import {
  OrganizationId,
  PropertyClaimId,
  UserId,
  AssetId,
} from '../../../domain/shared/EntityIds';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
export const propertyTestInstant = Instant.parse('2026-01-01T00:00:00.000Z');

export function propertyTestCreation(): { ids: IdGenerator; clock: Clock } {
  let next = 0;

  return {
    ids: { generate: (identity) => identity.parse(`created-${++next}`) },
    clock: { now: () => propertyTestInstant },
  };
}

export function submitTestClaim(
  organizationId: string,
  userId: string,
  assetId: string
) {
  return PropertyClaim.submit(
    OrganizationId.parse(organizationId),
    UserId.parse(userId),
    AssetId.parse(assetId),
    { id: PropertyClaimId.parse(`claim-${userId}`), now: propertyTestInstant }
  );
}
