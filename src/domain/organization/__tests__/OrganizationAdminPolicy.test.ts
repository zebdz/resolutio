import { UserId } from '../../shared/EntityIds';
import { describe, it, expect } from 'vitest';
import { OrganizationAdminPolicy } from '../OrganizationAdminPolicy';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('OrganizationAdminPolicy.ensureCanRemoveAdmin', () => {
  it('fails with LAST_ADMIN when the target is the only admin', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      [UserId.parse('admin-1')],
      UserId.parse('admin-1')
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationDomainCodes.LAST_ADMIN);
    }
  });

  it('allows removing an admin when at least one other remains', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      [UserId.parse('admin-1'), UserId.parse('admin-2')],
      UserId.parse('admin-1')
    );

    expect(result.success).toBe(true);
  });

  it('is a no-op success when the target is not an admin (no invariant to violate)', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      [UserId.parse('admin-1')],
      UserId.parse('not-an-admin')
    );

    expect(result.success).toBe(true);
  });

  it('allows removal from a larger admin set', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      [UserId.parse('a'), UserId.parse('b'), UserId.parse('c')],
      UserId.parse('b')
    );

    expect(result.success).toBe(true);
  });
});
