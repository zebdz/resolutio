import { describe, it, expect } from 'vitest';
import { OrganizationAdminPolicy } from '../OrganizationAdminPolicy';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

describe('OrganizationAdminPolicy.ensureCanRemoveAdmin', () => {
  it('fails with LAST_ADMIN when the target is the only admin', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      ['admin-1'],
      'admin-1'
    );

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(OrganizationDomainCodes.LAST_ADMIN);
    }
  });

  it('allows removing an admin when at least one other remains', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      ['admin-1', 'admin-2'],
      'admin-1'
    );

    expect(result.success).toBe(true);
  });

  it('is a no-op success when the target is not an admin (no invariant to violate)', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      ['admin-1'],
      'not-an-admin'
    );

    expect(result.success).toBe(true);
  });

  it('allows removal from a larger admin set', () => {
    const result = OrganizationAdminPolicy.ensureCanRemoveAdmin(
      ['a', 'b', 'c'],
      'b'
    );

    expect(result.success).toBe(true);
  });
});
