import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

/**
 * Domain policy for an organization's admin invariant: an organization must
 * always retain at least one admin.
 *
 * Admins are not part of the loaded {@link Organization} aggregate state, so
 * the rule lives here as a pure, side-effect-free policy that the application
 * layer consults with the current admin set. The repository additionally
 * re-enforces the same rule inside a transaction as a concurrency safety net
 * (see {@link LastAdminError}).
 */
export class OrganizationAdminPolicy {
  /**
   * Fails with LAST_ADMIN when removing `targetUserId` from the current admin
   * set would leave the organization with no admins. When the target is not an
   * admin, removal touches no admin role, so the invariant cannot be violated.
   */
  static ensureCanRemoveAdmin(
    currentAdminUserIds: string[],
    targetUserId: string
  ): Result<void, string> {
    const targetIsAdmin = currentAdminUserIds.includes(targetUserId);

    if (targetIsAdmin && currentAdminUserIds.length <= 1) {
      return failure(OrganizationDomainCodes.LAST_ADMIN);
    }

    return success(undefined);
  }
}
