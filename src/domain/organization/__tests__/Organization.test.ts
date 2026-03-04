import { describe, it, expect } from 'vitest';
import { Organization } from '../Organization';
import { OrganizationDomainCodes } from '../OrganizationDomainCodes';

function makeOrg(
  overrides?: Partial<Parameters<typeof Organization.reconstitute>[0]>
) {
  return Organization.reconstitute({
    id: 'org-1',
    name: 'Test Org',
    description: 'A test organization',
    parentId: null,
    createdById: 'user-1',
    createdAt: new Date(),
    archivedAt: null,
    ...overrides,
  });
}

describe('Organization.updateName', () => {
  it('should update name when valid', () => {
    const org = makeOrg();
    const result = org.updateName('New Name');

    expect(result.success).toBe(true);
    expect(org.name).toBe('New Name');
  });

  it('should trim whitespace', () => {
    const org = makeOrg();
    const result = org.updateName('  Trimmed Name  ');

    expect(result.success).toBe(true);
    expect(org.name).toBe('Trimmed Name');
  });

  it('should fail when empty', () => {
    const org = makeOrg();
    const result = org.updateName('');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }

    expect(org.name).toBe('Test Org');
  });

  it('should fail when only whitespace', () => {
    const org = makeOrg();
    const result = org.updateName('   ');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_EMPTY
      );
    }
  });

  it('should fail when longer than 255 chars', () => {
    const org = makeOrg();
    const result = org.updateName('a'.repeat(256));

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_NAME_TOO_LONG
      );
    }

    expect(org.name).toBe('Test Org');
  });
});

describe('Organization.updateDescription', () => {
  it('should update description when valid', () => {
    const org = makeOrg();
    const result = org.updateDescription('New description');

    expect(result.success).toBe(true);
    expect(org.description).toBe('New description');
  });

  it('should trim whitespace', () => {
    const org = makeOrg();
    const result = org.updateDescription('  Trimmed  ');

    expect(result.success).toBe(true);
    expect(org.description).toBe('Trimmed');
  });

  it('should fail when empty', () => {
    const org = makeOrg();
    const result = org.updateDescription('');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }

    expect(org.description).toBe('A test organization');
  });

  it('should fail when only whitespace', () => {
    const org = makeOrg();
    const result = org.updateDescription('   ');

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_EMPTY
      );
    }
  });

  it('should fail when longer than 2000 chars', () => {
    const org = makeOrg();
    const result = org.updateDescription('a'.repeat(2001));

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(
        OrganizationDomainCodes.ORGANIZATION_DESCRIPTION_TOO_LONG
      );
    }

    expect(org.description).toBe('A test organization');
  });
});
