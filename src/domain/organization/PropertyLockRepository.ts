/** Property-lock query port accepts validated identities and returns decoded
 * immutable snapshot facts instead of raw database alternatives. */
import { OrganizationId, PropertyId } from '../shared/EntityIds';
import { Result } from '../shared/Result';
import { LockSnapshotFact } from './PropertyLockService';
export type PropertyLockFailure = 'common.errors.unexpected';

export interface PropertyLockRepository {
  // Returns every snapshot fact for the organization: one row per (poll that has
  // at least one poll_eligible_members row). Used by PropertyLockService.
  findSnapshotFactsForOrg(
    organizationId: OrganizationId
  ): Promise<Result<LockSnapshotFact[], PropertyLockFailure>>;

  // Property-scoped variant — finds every poll that might have locked the given
  // property, including polls from ancestor orgs with empty scope (which
  // implicitly cover the whole tree). Use this in CorrectOwnership to catch
  // cross-tree locks where a parent-org poll scoped into a descendant property.
  findSnapshotFactsForProperty(
    propertyId: PropertyId
  ): Promise<Result<LockSnapshotFact[], PropertyLockFailure>>;
}
