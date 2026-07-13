/**
 * Thrown by the repository's transactional admin-removal guard when a deletion
 * would remove an organization's last admin.
 *
 * This is the concurrency safety net behind {@link OrganizationAdminPolicy}:
 * the application layer checks the invariant before calling the repository, but
 * a concurrent removal could still race between that check and the delete, so
 * the repository re-checks atomically inside the transaction and throws this
 * typed error (never a bare string) for the application to map to a domain code.
 */
export class LastAdminError extends Error {
  constructor() {
    super('Cannot remove the last admin of an organization');
    this.name = 'LastAdminError';
  }
}
