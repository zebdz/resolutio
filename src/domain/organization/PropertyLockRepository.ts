import { Result } from '../shared/Result';
import { LockSnapshotFact } from './PropertyLockService';

export interface PropertyLockRepository {
  // Returns every snapshot fact for the organization: one row per (poll that has
  // at least one poll_eligible_members row). Used by PropertyLockService.
  findSnapshotFactsForOrg(
    organizationId: string
  ): Promise<Result<LockSnapshotFact[], string>>;

  // Property-scoped variant — finds every poll that might have locked the given
  // property, including polls from ancestor orgs with empty scope (which
  // implicitly cover the whole tree). Use this in CorrectOwnership to catch
  // cross-tree locks where a parent-org poll scoped into a descendant property.
  findSnapshotFactsForProperty(
    propertyId: string
  ): Promise<Result<LockSnapshotFact[], string>>;
}
